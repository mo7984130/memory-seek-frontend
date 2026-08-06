<script setup lang="ts">
import { ref, nextTick, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { photo } from 'memory-seek-api'
import type { Photo } from 'memory-seek-api'
import { useWaterfallPage } from '@/composables/useWaterfallPage'
import { useListScrollRestore } from '@/composables/useListScrollRestore'
import VirtualWaterfall from '@/components/photo/VirtualWaterfall.vue'
import LastPositionButton from '@/components/photo/LastPositionButton.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import BackToTop from '@/components/actions/BackToTop/BackToTop.vue'

// 组件名（KeepAlive include 匹配）
defineOptions({ name: 'UnassignedFacesView' })

// 瀑布流页面（布局/加载/持久化/自动恢复）
const page = useWaterfallPage({
  storageKey: 'unassigned',
  fetch: async ({ cursor }) =>
    (await photo.face.getUnassignedFacePhotos({ cursor, size: 20 })).data,
})

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
} = page

const waterfallViewRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null)

// 返回时恢复滚动位置（KeepAlive 缓存页）
const { restoreScroll } = useListScrollRestore()

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
  const records = await fetchMore({ cursor: waterfall.cursor.value })
  return records.length > 0
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked
  }
}

function handleDelete(photoId: string) {
  waterfall.removePhoto(photoId)
}

/** 人脸变更（分配/取消/删除）后，若当前照片已不含未分配人脸则从列表移除 */
async function handleFacesUpdated() {
  const photoItem = selectedPhoto.value
  if (!photoItem) return
  try {
    const faces = (await photo.face.getFaces(photoItem.id)).data
    if (!faces.some((f) => !f.personId)) {
      waterfall.removePhoto(photoItem.id)
    }
  } catch (error) {
    console.error('[UnassignedFacesView] 刷新人脸状态失败:', error)
  }
}

async function handleLike(photoItem: Photo) {
  const photoId = photoItem.id as string
  try {
    await photo.like.unlikePhoto(photoId)
    waterfall.removePhoto(photoId)
  } catch (error) {
    console.error('[UnassignedFacesView] 取消点赞失败:', error)
  }
}

onMounted(() => {
  initialize(() => waterfallViewRef.value)
})

// 从其他页面返回时恢复浏览位置
onActivated(() => {
  restoreScroll()
})

onBeforeUnmount(() => {
  dispose()
})
</script>

<template>
  <div class="unassigned-view" :ref="page.containerRef">
    <div class="unassigned-view__header">
      <span class="unassigned-view__count" v-if="waterfall.allPhotos.value.length > 0">
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
          没有未分配人脸的照片
        </span>
      </div>
    </div>

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton storage-key="unassigned" @restore="restoreToLastPosition" />

    <!-- 回到顶部 -->
    <BackToTop />

    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      :photos="waterfall.allPhotos.value"
      :load-more="handleLoadMore"
      initial-show-faces
      @like="handleLikeChange"
      @delete="handleDelete"
      @navigate="handleViewerNavigate"
      @faces-updated="handleFacesUpdated"
    />
  </div>
</template>

<style scoped>
.unassigned-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.unassigned-view__header {
  margin: var(--spacing-5) 0;
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
}

.unassigned-view__count {
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
  .unassigned-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .unassigned-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
