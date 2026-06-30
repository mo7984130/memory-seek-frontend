<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { photo } from 'memory-seek-api'
import type { PhotoResult, MonthStat } from 'memory-seek-api'
import { useWaterfallPersistence } from '@/composables/useWaterfallPersistence'
import VirtualWaterfall, { type WaterfallItem, type WaterfallGroup } from '@/components/photo/VirtualWaterfall.vue'
import TimelineNav from '@/components/photo/TimelineNav.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'

// 使用持久化 composable
const waterfall = useWaterfallPersistence('photos')

// 本地 UI 状态
const containerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const columnCount = ref(4)
const containerWidth = ref(0)
const loading = ref(false)
const navigating = ref(false)

// 请求版本号，用于防止竞态条件
let fetchGeneration = 0

// 照片查看器状态（临时 UI 状态，不持久化）
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
 * 格式化月份标签
 */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${year}年${parseInt(month)}月`
}

/**
 * 按月分组
 */
const groups = computed<WaterfallGroup[]>(() => {
  if (!waterfall.allPhotos.value.length) return []

  const map = new Map<string, typeof waterfall.allPhotos.value>()
  for (const photo of waterfall.allPhotos.value) {
    const key = photo.createdAt.substring(0, 7) // "2026-06"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }

  return Array.from(map.entries()).map(([key, photos]) => ({
    key,
    label: formatMonthLabel(key),
    items: photos,
  }))
})

/**
 * 获取照片列表
 */
async function fetchPhotos() {
  if (loading.value || !waterfall.hasMore.value) return

  const gen = fetchGeneration
  loading.value = true
  console.log('[PhotoWaterfallView] 开始获取照片', { cursor: waterfall.cursor.value })

  try {
    const response = await photo.getPhotos({
      cursor: waterfall.cursor.value,
      size: 20,
      direction: 'next',
    })

    // 导航已发起新请求，丢弃本次结果
    if (gen !== fetchGeneration) return

    const { records, nextCursor, hasMore: more } = response.data
    waterfall.appendPhotos(records, nextCursor ?? undefined, more)
  } catch (error) {
    console.error('[PhotoWaterfallView] 获取照片失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 根据 ID 获取照片
 */
function getPhotoById(id: string | number): PhotoResult | undefined {
  return waterfall.allPhotos.value.find((p) => p.id === id)
}

/**
 * 点击照片处理
 */
function handlePhotoClick(photoItem: PhotoResult) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
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

async function handleLike(photoItem: PhotoResult) {
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

/**
 * 时间线导航跳转
 */
async function handleNavigate(groupKey: string) {
  if (navigating.value) return
  navigating.value = true
  fetchGeneration++

  try {
    const [yearStr, monthStr] = groupKey.split('-')
    const anchorTime = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr), 1)).toISOString()

    loading.value = true
    console.log('[PhotoWaterfallView] 时间线导航', { groupKey, anchorTime })

    const response = await photo.getPhotos({
      size: 20,
      direction: 'next',
      anchorTime,
    })
    const { records, nextCursor, hasMore: more } = response.data

    waterfall.replacePhotos(records, nextCursor ?? undefined, more)
    waterfall.currentGroup.value = groupKey

    await nextTick()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('[PhotoWaterfallView] 导航失败:', error)
  } finally {
    loading.value = false
    navigating.value = false
  }
}


// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !loading.value && waterfall.hasMore.value) {
    fetchPhotos()
  }
})

onMounted(async () => {
  handleResize()
  window.addEventListener('resize', handleResize)

  // 检查是否有缓存状态
  const restored = waterfall.onMount()
  if (restored) {
    console.log('[PhotoWaterfallView] 已恢复缓存状态，跳过加载')
    return
  }

  // 首次加载
  console.log('[PhotoWaterfallView] 首次加载')
  const [statsRes] = await Promise.all([
    photo.timeline.getMonthlyStats(),
    fetchPhotos(),
  ])

  waterfall.monthStats.value = statsRes.data
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  waterfall.onUnmount()
})
</script>

<template>
  <div class="photo-waterfall-view" ref="containerRef">
    <div class="waterfall-container">
      <VirtualWaterfall
        :groups="groups"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        @current-group-change="waterfall.currentGroup.value = $event"
      >
        <template #header="{ group }">
          <div class="group-header">
            <span class="group-header__icon">📅</span>
            <span class="group-header__label">{{ group.label }}</span>
          </div>
        </template>

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
      <div ref="sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!waterfall.hasMore.value" class="load-sentinel__text">已经到底啦 ~</span>
      </div>
    </div>

    <!-- 右侧时间线导航 -->
    <TimelineNav
      :month-stats="waterfall.monthStats.value"
      :current-group="waterfall.currentGroup.value"
      :navigating="navigating"
      @navigate="handleNavigate"
    />

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      @like="handleLikeChange"
      @delete="handleDelete"
    />
  </div>
</template>

<style scoped>
.group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  height: 100%;
}

.group-header__icon {
  font-size: var(--text-lg);
}

.group-header__label {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

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
