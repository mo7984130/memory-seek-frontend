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

// 请求版本号，用于防止竞态条件
let fetchGeneration = 0

// 时间线状态
const monthStats = ref<MonthStat[]>([])
const currentGroup = ref('')

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
  console.log('[groups] 重新计算, allPhotos长度:', allPhotos.value.length)
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

  const gen = fetchGeneration
  loading.value = true
  try {
    const response = await photo.getPhotos({
      cursor: cursor.value,
      size: 20,
      direction: 'next',
    })

    // 导航已发起新请求，丢弃本次结果
    if (gen !== fetchGeneration) return

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
function getPhotoById(id: string | number): PhotoResult | undefined {
  return allPhotos.value.find((p) => p.id === id)
}

/**
 * 点击照片处理
 */
function handlePhotoClick(photoItem: PhotoResult) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isLiked = isLiked
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
 * 时间线导航跳转：用 anchorTime 直接定位到目标月份，替换照片列表
 */
async function handleNavigate(groupKey: string) {
  console.log('[handleNavigate] 点击月份:', groupKey, { navigating: navigating.value })
  if (navigating.value) return
  navigating.value = true
  fetchGeneration++

  try {
    // 目标月份下月1日 00:00 UTC 作为锚点
    // groupKey 格式 "2023-02"，Date.UTC 月份从0开始，parseInt("02")=2 正好是下月
    const [yearStr, monthStr] = groupKey.split('-')
    const anchorTime = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr), 1)).toISOString()

    loading.value = true
    const response = await photo.getPhotos({
      size: 20,
      direction: 'next',
      anchorTime,
    })
    const { records, nextCursor, hasMore: more } = response.data

    // 替换照片列表
    allPhotos.value = records
    cursor.value = nextCursor ?? undefined
    hasMore.value = more
    currentGroup.value = groupKey

    // 等待 DOM 更新后滚动到顶部
    await nextTick()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('导航失败:', error)
  } finally {
    loading.value = false
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
        <span v-else-if="!hasMore" class="load-sentinel__text">已经到底啦 ~</span>
      </div>
    </div>

    <!-- 右侧时间线导航 -->
    <TimelineNav
      :month-stats="monthStats"
      :current-group="currentGroup"
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
