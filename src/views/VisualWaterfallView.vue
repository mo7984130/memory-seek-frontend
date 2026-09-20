<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onActivated,
  onBeforeUnmount,
} from "vue";
import { visual } from "memory-seek-api";
import type { Visual } from "memory-seek-api";
import dayjs from "dayjs";
import { useWaterfallPage } from "@/composables/useWaterfallPage";
import { useListScrollRestore } from "@/composables/useListScrollRestore";
import VisualWaterfall from "@/components/visual/VisualWaterfall.vue";
import TimelineNav from "@/components/visual/TimelineNav.vue";
import LastPositionButton from "@/components/visual/LastPositionButton.vue";
import WaterfallBookmarkPanel from "@/components/visual/WaterfallBookmarkPanel.vue";
import VisualViewer from "@/components/visual/VisualViewer.vue";
import type { WaterfallBookmark } from "@/composables/useWaterfallBookmarks";
import BackToTop from "@/components/actions/BackToTop/BackToTop.vue";

// 组件名（KeepAlive include 匹配）
defineOptions({ name: "VisualWaterfallView" });

// 瀑布流页面（布局/加载/持久化/自动恢复/时间线）
const page = useWaterfallPage({
  storageKey: "visuals",
  fetch: async ({ cursor, anchorTime }) =>
    (await visual.getVisuals({ cursor, anchorTime })).data,
  fetchTimeline: async () => (await visual.timeline.getMonthlyStats()).data,
});

const {
  waterfall,
  columnCount,
  containerWidth,
  loading,
  navigating,
  groups,
  topItemId,
  handleTopItemChange,
  restoreToLastPosition,
  initialize,
  dispose,
  navigateToMonth,
  navigateToAnchor,
} = page;

const waterfallViewRef = ref<InstanceType<typeof VisualWaterfall> | null>(
  null,
);

// 返回时恢复滚动位置（KeepAlive 缓存页）
const { restoreScroll } = useListScrollRestore();

// 影像查看器状态（临时 UI 状态，不持久化）
const viewerVisible = ref(false);
const selectedVisual = ref<Visual | null>(null);

function getVisualById(id: string | number): Visual | undefined {
  return waterfall.allVisuals.value.find((p) => p.id === id);
}

function formatMonthLabel(key: string): string {
  const parts = key.split("-");
  return `${parts[0]}年${parseInt(parts[1]!)}月`;
}

/**
 * 当前视口顶部的影像（用于生成位置书签锚点）
 */
const topVisual = computed(() => {
  if (topItemId.value == null) return null;
  return getVisualById(topItemId.value) ?? null;
});

/**
 * 当前浏览位置的锚点信息（顶部影像所在月份）
 */
const currentAnchor = computed(() => {
  const visual = topVisual.value;
  if (!visual?.createdAt) return null;
  const monthKey = visual.createdAt.substring(0, 7);
  return {
    label: formatMonthLabel(monthKey),
    monthKey,
    // 精确到顶部影像的拍摄时间：同一月份不同时刻保存的书签，跳转位置不同
    anchorTime: visual.createdAt,
    // 顶部影像的精确拍摄时间，用于更详细的位置提示
    detail: dayjs(visual.createdAt).format("YYYY年M月D日 HH:mm"),
  };
});

/**
 * 位置书签跳转：从书签记录的锚点重新加载影像流
 */
function handleBookmarkJump(bookmark: WaterfallBookmark) {
  navigateToAnchor(bookmark.anchorTime, bookmark.monthKey);
}

function handleVisualClick(visualItem: Visual) {
  selectedVisual.value = visualItem;
  viewerVisible.value = true;
}

/** 查看器切换影像：更新当前影像并让瀑布流滚动到对应位置 */
function handleViewerNavigate(visualItem: Visual) {
  selectedVisual.value = visualItem;
  nextTick(() => {
    waterfallViewRef.value?.scrollToItem(visualItem.id, "smooth");
  });
}

/** 查看器触底时加载下一页；返回是否加载到了新影像 */
async function handleLoadMore(): Promise<boolean> {
  if (loading.value || !waterfall.hasMore.value) return false;
  const records = await page.fetchMore({ cursor: waterfall.cursor.value });
  return records.length > 0;
}

/** 瀑布流触底/首屏填充的加载回调：返回本次新增条数 */
function loadMoreWaterfall(): Promise<number> {
  return page
    .fetchMore({ cursor: waterfall.cursor.value })
    .then((records) => records.length);
}

function handleLikeChange(visualId: string, isLiked: boolean) {
  waterfall.updateVisualLike(visualId, isLiked);
  if (selectedVisual.value?.id === visualId) {
    selectedVisual.value.isLiked = isLiked;
  }
}

function handleDelete(visualId: string) {
  waterfall.removeVisual(visualId);
}

async function handleLike(visualItem: Visual) {
  const visualId = visualItem.id as string;
  const wasLiked = visualItem.isLiked ?? false;

  // 乐观更新
  waterfall.updateVisualLike(visualId, !wasLiked);

  try {
    if (wasLiked) {
      await visual.like.unlikeVisual(visualId);
    } else {
      await visual.like.likeVisual(visualId);
    }
  } catch (error) {
    // 回滚
    waterfall.updateVisualLike(visualId, wasLiked);
    console.error("[VisualWaterfallView] 点赞操作失败:", error);
  }
}

onMounted(() => {
  initialize(() => waterfallViewRef.value);
});

// 从其他页面返回时恢复浏览位置
onActivated(() => {
  restoreScroll();
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<template>
  <div class="visual-waterfall-view" :ref="page.containerRef">
    <div class="waterfall-container">
      <VisualWaterfall
        ref="waterfallViewRef"
        :groups="groups"
        :visuals="waterfall.allVisuals.value"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        :has-more="waterfall.hasMore.value"
        :loading="loading"
        :load-more="loadMoreWaterfall"
        empty-text="还没有影像"
        @top-item-change="handleTopItemChange"
        @current-group-change="waterfall.currentGroup.value = $event"
        @visual-click="handleVisualClick"
        @like="handleLike"
      />
    </div>

    <!-- 右侧时间线导航 -->
    <TimelineNav
      :month-stats="waterfall.monthStats.value"
      :current-group="waterfall.currentGroup.value"
      :navigating="navigating"
      @navigate="navigateToMonth"
    />

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton storage-key="visuals" @restore="restoreToLastPosition" />

    <!-- 位置书签：保存当前浏览位置，点击后从该位置重新加载 -->
    <WaterfallBookmarkPanel
      storage-key="visuals"
      :current-anchor="currentAnchor"
      @jump="handleBookmarkJump"
    />

    <!-- 回到顶部 -->
    <BackToTop />

    <!-- 影像查看器 -->
    <VisualViewer
      v-model="viewerVisible"
      :visual="selectedVisual"
      :visuals="waterfall.allVisuals.value"
      :load-more="handleLoadMore"
      @like="handleLikeChange"
      @delete="handleDelete"
      @navigate="handleViewerNavigate"
    />
  </div>
</template>

<style scoped>
.visual-waterfall-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.waterfall-container {
  position: relative;
  width: 100%;
}

.load-sentinel {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-tertiary);
}

.load-sentinel__text {
  font-size: var(--text-sm);
  position: relative;
}

.load-sentinel__text::before,
.load-sentinel__text::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-border));
}

.load-sentinel__text::before {
  right: calc(100% + 12px);
}

.load-sentinel__text::after {
  left: calc(100% + 12px);
  background: linear-gradient(90deg, var(--color-border), transparent);
}

@media (max-width: 768px) {
  .visual-waterfall-view {
    padding: var(--spacing-4) var(--spacing-2);
  }
}
</style>
