<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { photo } from 'memory-seek-api'
import type { Photo } from 'memory-seek-api'
import { useWaterfallPage } from '@/composables/useWaterfallPage'
import VirtualWaterfall from '@/components/photo/VirtualWaterfall.vue'
import LastPositionButton from '@/components/photo/LastPositionButton.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import BackToTop from '@/components/actions/BackToTop/BackToTop.vue'

// 瀑布流页面（布局/加载/持久化/自动恢复）
const page = useWaterfallPage({
  storageKey: 'likes',
  fetch: async ({ cursor }) =>
    (await photo.like.getLikedPhotos({ cursor, size: 20 })).data,
})

const {
  waterfall,
  columnCount,
  containerWidth,
  loading,
  groups,
  handleTopItemChange,
  restoreToLastPosition,
  initialize,
  dispose,
} = page

const waterfallViewRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null)

// 照片查看器状态
const viewerVisible = ref(false)
const selectedPhoto = ref<Photo | null>(null)

function getPhotoById(id: string | number): Photo | undefined {
  return waterfall.allPhotos.value.find((p) => p.id === id)
}

function handlePhotoClick(photoItem: Photo) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  if (!isLiked) {
    // 在点赞页面，取消点赞需要从列表中移除
    waterfall.removePhoto(photoId)
  }
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked
  }
}

function handleDelete(photoId: string) {
  waterfall.removePhoto(photoId)
}

async function handleLike(photoItem: Photo) {
  const photoId = photoItem.id as string

  // 在点赞页面，取消点赞需要从列表中移除
  try {
    await photo.like.unlikePhoto(photoId)
    waterfall.removePhoto(photoId)
  } catch (error) {
    console.error('[LikesView] 取消点赞失败:', error)
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
  <div class="likes-view" :ref="page.containerRef">
    <div class="likes-view__header">
      <span class="likes-view__count" v-if="waterfall.allPhotos.value.length > 0">
        {{ waterfall.allPhotos.value.length }} 张照片
      </span>
    </div>

    <div class="waterfall-container">
      <VirtualWaterfall
        ref="waterfallViewRef"
        :groups="groups"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        @top-item-change="handleTopItemChange"
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

      <div :ref="page.sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!waterfall.hasMore.value && waterfall.allPhotos.value.length > 0" class="load-sentinel__text">
          已经到底啦 ~
        </span>
        <span v-else-if="!loading && waterfall.allPhotos.value.length === 0" class="load-sentinel__text">
          还没有点赞的照片
        </span>
      </div>
    </div>

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton storage-key="likes" @restore="restoreToLastPosition" />

    <!-- 回到顶部 -->
    <BackToTop />

    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      @like="handleLikeChange"
      @delete="handleDelete"
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
  .likes-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .likes-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
