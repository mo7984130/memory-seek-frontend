<script setup lang="ts">
import { ref, nextTick, onMounted, onActivated, onBeforeUnmount } from "vue";
import { visual } from "memory-seek-api";
import type { Visual } from "memory-seek-api";
import { useWaterfallPage } from "@/composables/useWaterfallPage";
import { useListScrollRestore } from "@/composables/useListScrollRestore";
import VisualWaterfall from "@/components/visual/VisualWaterfall.vue";
import LastPositionButton from "@/components/visual/LastPositionButton.vue";
import VisualViewer from "@/components/visual/VisualViewer.vue";
import BackToTop from "@/components/actions/BackToTop/BackToTop.vue";

// 组件名（KeepAlive include 匹配）
defineOptions({ name: "LikesView" });

// 瀑布流页面（布局/加载/持久化/自动恢复）
const page = useWaterfallPage({
  storageKey: "likes",
  fetch: async ({ cursor }) =>
    (await visual.like.getLikedVisuals({ cursor })).data,
});

const {
  waterfall,
  columnCount,
  containerWidth,
  loading,
  groups,
  fetchMore,
  handleTopItemChange,
  restoreToLastPosition,
  initialize,
  dispose,
} = page;

const waterfallViewRef = ref<InstanceType<typeof VisualWaterfall> | null>(null);

// 返回时恢复滚动位置（KeepAlive 缓存页）
const { restoreScroll } = useListScrollRestore();

// 影像查看器状态
const viewerVisible = ref(false);
const selectedVisual = ref<Visual | null>(null);

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
  const records = await fetchMore({ cursor: waterfall.cursor.value });
  return records.length > 0;
}

/** 瀑布流触底/首屏填充的加载回调：返回本次新增条数 */
function loadMoreWaterfall(): Promise<number> {
  return fetchMore({ cursor: waterfall.cursor.value }).then(
    (records) => records.length,
  );
}

function handleLikeChange(visualId: string, isLiked: boolean) {
  if (!isLiked) {
    // 在点赞页面，取消点赞需要从列表中移除
    waterfall.removeVisual(visualId);
  }
  if (selectedVisual.value?.id === visualId) {
    selectedVisual.value.isLiked = isLiked;
  }
}

function handleDelete(visualId: string) {
  waterfall.removeVisual(visualId);
}

async function handleLike(visualItem: Visual) {
  const visualId = visualItem.id as string;

  // 在点赞页面，取消点赞需要从列表中移除
  try {
    await visual.like.unlikeVisual(visualId);
    waterfall.removeVisual(visualId);
  } catch (error) {
    console.error("[LikesView] 取消点赞失败:", error);
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
  <div class="likes-view" :ref="page.containerRef">
    <div class="likes-view__header">
      <span
        class="likes-view__count"
        v-if="waterfall.allVisuals.value.length > 0"
      >
        {{ waterfall.allVisuals.value.length }} 张影像
      </span>
    </div>

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
        empty-text="还没有点赞的影像"
        @top-item-change="handleTopItemChange"
        @visual-click="handleVisualClick"
        @like="handleLike"
      />
    </div>

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton storage-key="likes" @restore="restoreToLastPosition" />

    <!-- 回到顶部 -->
    <BackToTop />

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
.likes-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.likes-view__header {
  margin: var(--spacing-5) 0;
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
}

.likes-view__count {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-left: var(--spacing-2);
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
  .likes-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .likes-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
