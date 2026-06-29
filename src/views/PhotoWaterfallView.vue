<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { photo } from 'memory-seek-api'
import type { PhotoResult, MonthStat } from 'memory-seek-api'
import VirtualWaterfall, { type WaterfallItem, type WaterfallGroup } from '@/components/photo/VirtualWaterfall.vue'
import TimelineNav from '@/components/photo/TimelineNav.vue'
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
const navigating = ref(false)

// 时间线状态
const monthStats = ref<MonthStat[]>([])
const currentGroup = ref('')
const waterfallRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null)

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
  if (!allPhotos.value.length) return []

  const map = new Map<string, typeof allPhotos.value>()
  for (const photo of allPhotos.value) {
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

function handleLikeChange(photoId: string) {
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isLiked = !target.isLiked
  }
}

async function handleLike(photoItem: PhotoResult) {
  const photoId = photoItem.id as string
  const wasLiked = photoItem.isLiked ?? false

  // 乐观更新 UI
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isLiked = !wasLiked
  }

  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId)
    } else {
      await photo.like.likePhoto(photoId)
    }
  } catch (error) {
    // 回滚
    if (target) {
      target.isLiked = wasLiked
    }
    console.error('点赞操作失败:', error)
  }
}

/**
 * 加载照片直到包含目标月份
 */
async function loadUntilGroup(targetKey: string) {
  while (hasMore.value) {
    await fetchPhotos()
    const hasTarget = allPhotos.value.some(
      (p) => p.createdAt.substring(0, 7) === targetKey,
    )
    if (hasTarget) break
  }
}

/**
 * 时间线导航跳转
 */
async function handleNavigate(groupKey: string) {
  if (navigating.value) return
  navigating.value = true

  try {
    // 检查目标月份是否已加载
    const hasTarget = groups.value.some((g) => g.key === groupKey)

    if (!hasTarget) {
      await loadUntilGroup(groupKey)
    }

    await nextTick()
    waterfallRef.value?.scrollToGroup(groupKey)
  } finally {
    navigating.value = false
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

  // 并行加载月份统计和首批照片
  const [statsRes] = await Promise.all([
    photo.timeline.getMonthlyStats(),
    fetchPhotos(),
  ])

  monthStats.value = statsRes.data
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="photo-waterfall-view" ref="containerRef">
    <div class="waterfall-container">
      <VirtualWaterfall
        ref="waterfallRef"
        :groups="groups"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        @current-group-change="currentGroup = $event"
      >
        <template #header="{ group }">
          <div class="group-header">
            <span class="group-header__icon">📅</span>
            <span class="group-header__label">{{ group.label }}</span>
          </div>
        </template>

        <template #default="{ item }">
          <PhotoCard
            :item="getPhotoById(item.id)"
            @click="handlePhotoClick"
            @like="handleLike"
          />
        </template>
      </VirtualWaterfall>

      <!-- 加载指示器 -->
      <div ref="sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!hasMore" class="load-sentinel__text">已经到底啦 ~</span>
      </div>
    </div>

    <!-- 右侧时间线导航 -->
    <TimelineNav
      :month-stats="monthStats"
      :current-group="currentGroup"
      @navigate="handleNavigate"
    />

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      @like="handleLikeChange"
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
