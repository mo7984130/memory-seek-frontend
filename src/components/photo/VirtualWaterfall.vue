<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import Spinner from "@/components/base/Spinner/Spinner.vue";

/**
 * 通用瀑布流项目接口：不绑定具体业务类型，
 * 渲染与高度由插槽 / itemHeight 决定。
 */
export interface WaterfallItem {
  id: string | number;
  /** 仅按宽高比计算高度时使用（照片兼容），其余场景可省略 */
  width?: number;
  height?: number;
  [key: string]: any;
}

/**
 * 瀑布流分组接口
 */
export interface WaterfallGroup {
  key: string; // 分组标识，如 "2026-06"
  label: string; // 显示文本，如 "2026年6月"
  items: WaterfallItem[];
}

const props = withDefaults(
  defineProps<{
    items?: WaterfallItem[]; // 无分组模式
    groups?: WaterfallGroup[]; // 分组模式
    columnCount: number;
    containerWidth: number;
    gap?: number;
    buffer?: number;
    groupHeaderHeight?: number; // 分组标题高度
    /**
     * 自定义卡片高度（用于非照片型内容）：
     * - 数字：所有卡片统一高度
     * - 函数：按卡片返回高度（参数为卡片与列宽）
     * - 不传：按图片宽高比计算（兼容照片）
     */
    itemHeight?: number | ((item: WaterfallItem, colWidth: number) => number);
    // ======== 内置加载（触底加载 + 首屏填充） ========
    /** 是否还有更多数据 */
    hasMore?: boolean;
    /** 是否正在加载 */
    loading?: boolean;
    /** 拉取一页；返回本次新增条数以驱动首屏自动填充 */
    loadMore?: () => Promise<number | void>;
    /** 列表为空时的提示文案 */
    emptyText?: string;
  }>(),
  {
    gap: 16,
    buffer: 800,
    groupHeaderHeight: 48,
    hasMore: false,
    loading: false,
  },
);

const emit = defineEmits<{
  (e: "top-item-change", item: WaterfallItem): void;
  (e: "current-group-change", key: string): void;
}>();

// 视口高度
const windowHeight = ref(window.innerHeight);
// 滚动位置
const scrollY = ref(0);
// 容器 ref
const waterfallRef = ref<HTMLElement | null>(null);
// 加载哨兵 ref
const sentinelRef = ref<HTMLElement | null>(null);

/**
 * 定位后的项目（照片/卡片或分组标题）
 */
interface PositionedItem {
  id: string | number;
  type: "item" | "header";
  groupKey?: string; // 分组标题的 key
  groupLabel?: string; // 分组标题的文本
  renderTop: number;
  renderLeft: number;
  renderWidth: number;
  renderHeight: number;
  [key: string]: any;
}

/**
 * 计算卡片显示高度：
 * - 传入 itemHeight（数字或函数）时按自定义高度
 * - 否则按图片宽高比计算
 */
function getDisplayHeight(item: WaterfallItem, colWidth: number): number {
  if (typeof props.itemHeight === "function") {
    return props.itemHeight(item, colWidth);
  }
  if (typeof props.itemHeight === "number") {
    return props.itemHeight;
  }
  const ratio = (item.height || 100) / (item.width || 100);
  return colWidth * ratio;
}

/**
 * 计算每张照片的绝对定位坐标
 */
const positionedItems = computed<PositionedItem[]>(() => {
  const _containerWidth = props.containerWidth;

  if (_containerWidth <= 0) return [];

  const colWidth =
    (_containerWidth - (props.columnCount - 1) * props.gap) / props.columnCount;
  const heights = Array.from<number>({ length: props.columnCount }).fill(0);

  // 分组模式
  if (props.groups && props.groups.length > 0) {
    const result: PositionedItem[] = [];

    for (const group of props.groups) {
      // 分组标题：占满整行
      const headerTop = Math.max(...heights);
      result.push({
        id: `header-${group.key}`,
        type: "header",
        groupKey: group.key,
        groupLabel: group.label,
        renderTop: headerTop,
        renderLeft: 0,
        renderWidth: props.containerWidth,
        renderHeight: props.groupHeaderHeight,
      });
      heights.fill(headerTop + props.groupHeaderHeight + props.gap);

      // 组内照片
      for (const item of group.items) {
        const minHeight = Math.min(...heights);
        const minIndex = heights.indexOf(minHeight);
        const displayHeight = getDisplayHeight(item, colWidth);

        result.push({
          ...item,
          type: "item",
          renderTop: minHeight,
          renderLeft: minIndex * (colWidth + props.gap),
          renderHeight: displayHeight,
          renderWidth: colWidth,
        });

        heights[minIndex] += displayHeight + props.gap;
      }
    }

    return result;
  }

  // 无分组模式（原有逻辑）
  if (props.items) {
    return props.items.map((item) => {
      const minHeight = Math.min(...heights);
      const minIndex = heights.indexOf(minHeight);
      const displayHeight = getDisplayHeight(item, colWidth);

      const pos: PositionedItem = {
        ...item,
        type: "item",
        renderTop: minHeight,
        renderLeft: minIndex * (colWidth + props.gap),
        renderHeight: displayHeight,
        renderWidth: colWidth,
      };

      heights[minIndex] += displayHeight + props.gap;
      return pos;
    });
  }

  return [];
});

/**
 * 虚拟滚动：只渲染视口内的元素
 */
const visibleItems = computed(() => {
  const start = scrollY.value - props.buffer;
  const end = scrollY.value + windowHeight.value + props.buffer;

  return positionedItems.value.filter(
    (p) => p.renderTop + p.renderHeight > start && p.renderTop < end,
  );
});

/**
 * 已加载的卡片总数（用于空态判断）
 */
const itemCount = computed(() => {
  if (props.groups) {
    return props.groups.reduce((n, g) => n + g.items.length, 0);
  }
  return props.items?.length ?? 0;
});

/**
 * 跟踪最顶部的分组并触发事件（从 computed 中抽离，避免副作用）
 */
watch(visibleItems, (filtered) => {
  if (filtered.length === 0) return;

  // 优先取视口内（不含 buffer）最靠上的元素，
  // 避免顶部照片滞后于视口上方 buffer 区域导致位置锚点不准
  const viewportStart = scrollY.value;
  const viewportEnd = scrollY.value + windowHeight.value;
  const inViewport = filtered.filter(
    (p) =>
      p.renderTop + p.renderHeight > viewportStart && p.renderTop < viewportEnd,
  );
  const topItem = (inViewport.length > 0 ? inViewport : filtered).reduce(
    (prev, curr) => (prev.renderTop < curr.renderTop ? prev : curr),
  );

  let currentGroupKey = "";
  if (topItem.type === "header") {
    currentGroupKey = topItem.groupKey || "";
  } else {
    // 找 renderTop <= topItem.renderTop 中最大的那个 header
    const headerItem = positionedItems.value
      .filter(
        (p) =>
          p.type === "header" && p.groupKey && p.renderTop <= topItem.renderTop,
      )
      .reduce(
        (best, curr) =>
          !best || curr.renderTop > best.renderTop ? curr : best,
        null as PositionedItem | null,
      );
    currentGroupKey = headerItem?.groupKey || "";
  }

  if (currentGroupKey) {
    emit("current-group-change", currentGroupKey);
  }

  if (topItem.type === "item") {
    emit("top-item-change", topItem as unknown as WaterfallItem);
  } else {
    // 视口顶部是分组标题时，取其下方视口内最近的照片作为"顶部照片"
    const firstPhoto = inViewport
      .filter((p) => p.type === "item" && p.renderTop >= topItem.renderTop)
      .reduce(
        (prev, curr) =>
          prev && prev.renderTop <= curr.renderTop ? prev : curr,
        null as PositionedItem | null,
      );
    if (firstPhoto) {
      emit("top-item-change", firstPhoto as unknown as WaterfallItem);
    }
  }
});

/**
 * 容器总高度（撑开父容器）
 */
const containerHeight = computed(() => {
  if (positionedItems.value.length === 0) return 100;
  return positionedItems.value.reduce(
    (max, p) => Math.max(max, p.renderTop + p.renderHeight),
    0,
  );
});

/**
 * 滚动事件处理
 */
function handleScroll() {
  scrollY.value = window.scrollY;
}

/**
 * 窗口大小变化处理
 */
function handleResize() {
  windowHeight.value = window.innerHeight;
}

// ======== 内置加载：触底 + 首屏填充 ========

/**
 * 触发一次加载：
 * - IntersectionObserver 只在交叉状态变化时触发，哨兵持续可见时不会重复回调，
 *   因此加载完成后若哨兵仍在视口内（首屏未填满）则递归续载，直至撑满视口或数据耗尽。
 */
let isFetching = false;
async function triggerLoadMore() {
  if (isFetching || !props.loadMore) return;
  if (props.loading || !props.hasMore) return;

  isFetching = true;
  try {
    const added = await props.loadMore();
    await nextTick();
    if (
      typeof added === "number" &&
      added > 0 &&
      !props.loading &&
      props.hasMore &&
      sentinelRef.value
    ) {
      const rect = sentinelRef.value.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        await triggerLoadMore();
      }
    }
  } finally {
    isFetching = false;
  }
}

// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false;
  if (isIntersecting) triggerLoadMore();
});

// 外部首屏加载（loading 结束）后补一次填充检查
watch(
  () => props.loading,
  (val) => {
    if (!val) triggerLoadMore();
  },
);

/**
 * 滚动到指定分组
 */
function scrollToGroup(groupKey: string) {
  const header = positionedItems.value.find(
    (p) => p.type === "header" && p.groupKey === groupKey,
  );
  if (!header) {
    console.warn(
      `scrollToGroup: 未找到分组 ${groupKey}，当前分组:`,
      positionedItems.value
        .filter((p) => p.type === "header")
        .map((p) => p.groupKey),
    );
    return;
  }

  if (!waterfallRef.value) {
    console.warn("scrollToGroup: 容器 ref 未就绪");
    return;
  }
  const containerRect = waterfallRef.value.getBoundingClientRect();
  const scrollTop = containerRect.top + window.scrollY + header.renderTop;
  window.scrollTo({
    top: scrollTop,
    behavior: "smooth",
  });
}

/**
 * 滚动到指定照片（用于恢复浏览位置）
 * @param behavior 滚动行为，默认 'auto'（立即定位）；查看器切换照片时传 'smooth' 同步位置
 */
function scrollToItem(
  photoId: string | number,
  behavior: ScrollBehavior = "auto",
) {
  const item = positionedItems.value.find(
    (p) => p.type === "item" && p.id === photoId,
  );
  if (!item) {
    console.warn(`scrollToItem: 未找到照片 ${photoId}`);
    return;
  }

  if (!waterfallRef.value) {
    console.warn("scrollToItem: 容器 ref 未就绪");
    return;
  }
  const containerRect = waterfallRef.value.getBoundingClientRect();
  const scrollTop = containerRect.top + window.scrollY + item.renderTop;
  window.scrollTo({
    top: scrollTop,
    behavior,
  });
}

defineExpose({ scrollToGroup, scrollToItem });

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll);
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <div
    class="virtual-waterfall"
    ref="waterfallRef"
    :style="{ height: containerHeight + 'px' }"
  >
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="waterfall-item"
      :class="{ 'waterfall-item--header': item.type === 'header' }"
      :style="{
        width: `${item.renderWidth}px`,
        height: `${item.renderHeight}px`,
        transform: `translate3d(${item.renderLeft}px, ${item.renderTop}px, 0)`,
      }"
    >
      <!-- 分组标题（默认渲染纯文本，页面可传 #header 插槽自定义） -->
      <slot
        v-if="item.type === 'header'"
        name="header"
        :group="{ key: item.groupKey, label: item.groupLabel }"
      >
        <div class="waterfall-group-header">
          <span class="waterfall-group-header__label">{{
            item.groupLabel
          }}</span>
        </div>
      </slot>
      <!-- 卡片（最小单位：任意卡片，如 PhotoCard / 人物卡片） -->
      <slot v-else :item="item" />
    </div>
  </div>

  <!-- 加载哨兵 + 状态指示器 -->
  <div ref="sentinelRef" class="waterfall-sentinel">
    <Spinner v-if="loading" />
    <span
      v-else-if="itemCount > 0 && !hasMore"
      class="waterfall-sentinel__text"
    >
      已经到底啦 ~
    </span>
    <span v-else-if="itemCount === 0 && !loading && emptyText" class="waterfall-sentinel__text">
      {{ emptyText }}
    </span>
  </div>
</template>

<style scoped>
.virtual-waterfall {
  position: relative;
  width: 100%;
}

.waterfall-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 0.3s var(--ease-out);
}

.waterfall-item--header {
  z-index: 1;
}

.waterfall-group-header {
  display: flex;
  align-items: center;
  height: 100%;
  padding: var(--spacing-2) 0;
}

.waterfall-group-header__label {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.waterfall-sentinel {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-tertiary);
}

.waterfall-sentinel__text {
  font-size: var(--text-sm);
  position: relative;
}

.waterfall-sentinel__text::before,
.waterfall-sentinel__text::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-border));
}

.waterfall-sentinel__text::before {
  right: calc(100% + 12px);
}

.waterfall-sentinel__text::after {
  left: calc(100% + 12px);
  background: linear-gradient(90deg, var(--color-border), transparent);
}
</style>
