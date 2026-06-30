<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { photo } from 'memory-seek-api'
import type { PhotoResult } from 'memory-seek-api'
import VirtualWaterfall, { type WaterfallItem } from '@/components/photo/VirtualWaterfall.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'

// 状态
const containerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const allPhotos = ref<PhotoResult[]>([])
const columnCount = ref(4)
const containerWidth = ref(0)
const loading = ref(false)
const hasMore = ref(true)
const cursor = ref<string | undefined>(undefined)
const total = ref(0)

// 照片查看器状态
const viewerVisible = ref(false)
const selectedPhoto = ref<PhotoResult | null>(null)

/**
 * 计算列数和容器宽度
 */
function handleResize() {
  if (!containerRef.value) return
  const style = getComputedStyle(containerRef.value)
  const paddingLeft = parseInt(style.paddingLeft) || 0
  const paddingRight = parseInt(style.paddingRight) || 0
  containerWidth.value = containerRef.value.clientWidth - paddingLeft - paddingRight

  if (containerWidth.value < 640) {
    columnCount.value = 2
  } else if (containerWidth.value < 1024) {
    columnCount.value = 3
  } else if (containerWidth.value < 1440) {
    columnCount.value = 4
  } else {
    columnCount.value = 5
  }
}

/**
 * 获取点赞照片列表
 */
async function fetchPhotos() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  try {
    const response = await photo.like.getLikedPhotos({
      cursor: cursor.value,
      size: 20,
    })
    const { records, nextCursor, hasMore: more } = response.data

    allPhotos.value.push(...records)
    cursor.value = nextCursor ?? undefined
    hasMore.value = more
    if (!cursor.value) {
      total.value = allPhotos.value.length
    }
  } catch (error) {
    console.error('获取点赞照片失败:', error)
  } finally {
    loading.value = false
  }
}

function getPhotoById(id: string | number): PhotoResult {
  return allPhotos.value.find((p) => p.id === id) as PhotoResult
}

function handlePhotoClick(photoItem: PhotoResult) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  if (!isLiked) {
    // 在点赞页面，取消点赞需要从列表中移除
    allPhotos.value = allPhotos.value.filter((p) => p.id !== photoId)
  }
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked
  }
}

function handleDelete(photoId: string) {
  allPhotos.value = allPhotos.value.filter((p) => p.id !== photoId)
}

async function handleLike(photoItem: PhotoResult) {
  const photoId = photoItem.id as string

  // 在点赞页面，取消点赞需要从列表中移除
  try {
    await photo.like.unlikePhoto(photoId)
    allPhotos.value = allPhotos.value.filter((p) => p.id !== photoId)
  } catch (error) {
    console.error('取消点赞失败:', error)
  }
}

// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !loading.value && hasMore.value) {
    fetchPhotos()
  }
})

onMounted(async () => {
  handleResize()
  window.addEventListener('resize', handleResize)

  // 确保滚动到顶部
  await nextTick()
  window.scrollTo(0, 0)

  fetchPhotos()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="likes-view" ref="containerRef">
    <div class="likes-view__header">
      <span class="likes-view__count" v-if="allPhotos.length > 0">
        {{ allPhotos.length }} 张照片
      </span>
    </div>

    <div class="waterfall-container">
      <VirtualWaterfall
        :items="allPhotos as WaterfallItem[]"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
      >
        <template #default="{ item }">
          <PhotoCard
            :item="getPhotoById(item.id)"
            @click="handlePhotoClick"
            @like="handleLike"
          />
        </template>
      </VirtualWaterfall>

      <div ref="sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!hasMore && allPhotos.length > 0" class="load-sentinel__text">
          已经到底啦 ~
        </span>
        <span v-else-if="!loading && allPhotos.length === 0" class="load-sentinel__text">
          还没有点赞的照片
        </span>
      </div>
    </div>

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
