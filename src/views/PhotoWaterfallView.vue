<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { photo } from 'memory-seek-api'
import type { Photo } from 'memory-seek-api'
import dayjs from 'dayjs'
import { useWaterfallPage } from '@/composables/useWaterfallPage'
import VirtualWaterfall from '@/components/photo/VirtualWaterfall.vue'
import TimelineNav from '@/components/photo/TimelineNav.vue'
import LastPositionButton from '@/components/photo/LastPositionButton.vue'
import WaterfallBookmarkPanel from '@/components/photo/WaterfallBookmarkPanel.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import type { WaterfallBookmark } from '@/composables/useWaterfallBookmarks'
import BackToTop from '@/components/actions/BackToTop/BackToTop.vue'

// 瀑布流页面（布局/加载/持久化/自动恢复/时间线）
const page = useWaterfallPage({
  storageKey: 'photos',
  fetch: async ({ cursor, anchorTime }) =>
    (await photo.getPhotos({ cursor, size: 20, direction: 'next', anchorTime })).data,
  fetchTimeline: async () => (await photo.timeline.getMonthlyStats()).data,
})

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
} = page

const waterfallViewRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null)

// 照片查看器状态（临时 UI 状态，不持久化）
const viewerVisible = ref(false)
const selectedPhoto = ref<Photo | null>(null)

function getPhotoById(id: string | number): Photo | undefined {
  return waterfall.allPhotos.value.find((p) => p.id === id)
}

function formatMonthLabel(key: string): string {
  const parts = key.split('-')
  return `${parts[0]}年${parseInt(parts[1]!)}月`
}

/**
 * 当前视口顶部的照片（用于生成位置书签锚点）
 */
const topPhoto = computed(() => {
  if (topItemId.value == null) return null
  return getPhotoById(topItemId.value) ?? null
})

/**
 * 当前浏览位置的锚点信息（顶部照片所在月份）
 */
const currentAnchor = computed(() => {
  const photo = topPhoto.value
  if (!photo?.createdAt) return null
  const monthKey = photo.createdAt.substring(0, 7)
  return {
    label: formatMonthLabel(monthKey),
    monthKey,
    // 精确到顶部照片的拍摄时间：同一月份不同时刻保存的书签，跳转位置不同
    anchorTime: photo.createdAt,
    // 顶部照片的精确拍摄时间，用于更详细的位置提示
    detail: dayjs(photo.createdAt).format('YYYY年M月D日 HH:mm'),
  }
})

/**
 * 位置书签跳转：从书签记录的锚点重新加载照片流
 */
function handleBookmarkJump(bookmark: WaterfallBookmark) {
  navigateToAnchor(bookmark.anchorTime, bookmark.monthKey)
}

function handlePhotoClick(photoItem: Photo) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

/** 查看器切换照片：更新当前照片并让瀑布流滚动到对应位置 */
function handleViewerNavigate(photoItem: Photo) {
  selectedPhoto.value = photoItem
  nextTick(() => {
    waterfallViewRef.value?.scrollToItem(photoItem.id, 'smooth')
  })
}

/** 查看器触底时加载下一页；返回是否加载到了新照片 */
async function handleLoadMore(): Promise<boolean> {
  if (loading.value || !waterfall.hasMore.value) return false
  const records = await page.fetchMore({ cursor: waterfall.cursor.value })
  return records.length > 0
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  waterfall.updatePhotoLike(photoId, isLiked)
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked
  }
}

function handleDelete(photoId: string) {
  waterfall.removePhoto(photoId)
}

async function handleLike(photoItem: Photo) {
  const photoId = photoItem.id as string
  const wasLiked = photoItem.isLiked ?? false

  // 乐观更新
  waterfall.updatePhotoLike(photoId, !wasLiked)

  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId)
    } else {
      await photo.like.likePhoto(photoId)
    }
  } catch (error) {
    // 回滚
    waterfall.updatePhotoLike(photoId, wasLiked)
    console.error('[PhotoWaterfallView] 点赞操作失败:', error)
  }
}

onMounted(() => {
  initialize(() => waterfallViewRef.value)
})

onBeforeUnmount(() => {
  dispose()
})
</script>

<template>
  <div class="photo-waterfall-view" :ref="page.containerRef">
    <div class="waterfall-container">
      <VirtualWaterfall
        ref="waterfallViewRef"
        :groups="groups"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        @top-item-change="handleTopItemChange"
        @current-group-change="waterfall.currentGroup.value = $event"
      >
        <template #default="{ item }">
          <PhotoCard
            v-if="getPhotoById(item.id)"
            :item="getPhotoById(item.id)!"
            @click="handlePhotoClick"
            @like="handleLike"
          />
        </template>
      </VirtualWaterfall>

      <!-- 加载指示器 -->
      <div :ref="page.sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!waterfall.hasMore.value" class="load-sentinel__text">
          已经到底啦 ~
        </span>
      </div>
    </div>

    <!-- 右侧时间线导航 -->
    <TimelineNav
      :month-stats="waterfall.monthStats.value"
      :current-group="waterfall.currentGroup.value"
      :navigating="navigating"
      @navigate="navigateToMonth"
    />

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton storage-key="photos" @restore="restoreToLastPosition" />

    <!-- 位置书签：保存当前浏览位置，点击后从该位置重新加载 -->
    <WaterfallBookmarkPanel
      storage-key="photos"
      :current-anchor="currentAnchor"
      @jump="handleBookmarkJump"
    />

    <!-- 回到顶部 -->
    <BackToTop />

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      :photos="waterfall.allPhotos.value"
      :load-more="handleLoadMore"
      @like="handleLikeChange"
      @delete="handleDelete"
      @navigate="handleViewerNavigate"
    />
  </div>
</template>

<style scoped>
.photo-waterfall-view {
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
  content: '';
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
  .photo-waterfall-view {
    padding: var(--spacing-4) var(--spacing-2);
  }
}
</style>
