<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
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

  // 响应式列数
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
 * 获取照片列表
 */
async function fetchPhotos() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  try {
    const response = await photo.getPhotos({
      cursor: cursor.value,
      size: 20,
      direction: 'next',
    })
    const { records, nextCursor, hasMore: more } = response.data

    allPhotos.value.push(...records)
    cursor.value = nextCursor ?? undefined
    hasMore.value = more
  } catch (error) {
    console.error('获取照片失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 根据 ID 获取照片
 */
function getPhotoById(id: string | number): PhotoResult {
  return allPhotos.value.find((p) => p.id === id) as PhotoResult
}

/**
 * 点击照片处理
 */
function handlePhotoClick(photoItem: PhotoResult) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

function handleFavoriteChange(photoId: string) {
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isFavorited = !target.isFavorited
  }
}

// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !loading.value && hasMore.value) {
    fetchPhotos()
  }
})

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  fetchPhotos()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="photo-waterfall-view" ref="containerRef">
    <h2 class="page-title">照片墙</h2>

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
          />
        </template>
      </VirtualWaterfall>

      <!-- 加载指示器 -->
      <div ref="sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!hasMore" class="load-sentinel__text">已经到底啦 ~</span>
      </div>
    </div>

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      @favorite="handleFavoriteChange"
    />
  </div>
</template>

<style scoped>
.photo-waterfall-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.page-title {
  margin: var(--spacing-5) 0;
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-light);
  color: var(--color-text-primary);
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

  .page-title {
    font-size: var(--text-xl);
    margin: var(--spacing-4) 0;
  }
}
</style>
