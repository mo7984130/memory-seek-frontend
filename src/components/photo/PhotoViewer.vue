<!-- src/components/photo/PhotoViewer.vue -->
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { photo as photoApi } from 'memory-seek-api'
import type { PhotoResult } from 'memory-seek-api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/components/feedback/Toast/toast'
import Modal from '@/components/feedback/Modal/Modal.vue'
import CollectionSelector from '@/components/data/CollectionSelector/CollectionSelector.vue'
import PhotoToolbar from './PhotoToolbar.vue'
import PhotoComments from './PhotoComments.vue'
import './photo-viewer.css'

interface Props {
  modelValue: boolean
  photo: PhotoResult | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'like': [photoId: string, isLiked: boolean]
  'delete': [photoId: string]
}>()

const authStore = useAuthStore()
const toast = useToast()

// ---- 状态 ----
const zoom = ref(1)
const baseZoom = ref(1)
const rotation = ref(0)
const translateX = ref(0)
const translateY = ref(0)
const imageWidth = ref(0)
const imageHeight = ref(0)
const showComments = ref(false)
const showCollectionSelector = ref(false)
const showOriginal = ref(false)
const loadingOriginal = ref(false)
const refreshing = ref(false)
const showDeleteConfirm = ref(false)
const deleting = ref(false)

// 拖拽状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartTranslateX = ref(0)
const dragStartTranslateY = ref(0)

// 原图缓存（仅当前会话有效）
const originalUrl = ref<string | null>(null)

// 图片加载状态
const imageLoading = ref(true)

// 缩放常量（相对于 baseZoom 的倍数）
const ZOOM_RATIO_MIN = 0.25
const ZOOM_RATIO_MAX = 4
const ZOOM_RATIO_STEP = 0.25

// ---- 计算属性 ----

/** 是否有原图 token */
const hasOriginalToken = computed(() => !!props.photo?.originalToken)

/** 当前显示的图片 URL */
const imageUrl = computed(() => {
  if (!props.photo) return null

  // 显示原图：用缓存或 token URL
  if (showOriginal.value) {
    return originalUrl.value || (props.photo.originalToken ? photoApi.getImgUrl(props.photo.originalToken) : null)
  }

  // 显示预览图：直接用 token URL
  const token = props.photo.previewToken || props.photo.thumbnailToken
  return token ? photoApi.getImgUrl(token) : null
})

/** 图片 transform 样式（zoom 相对于 baseZoom 的比值） */
const imageTransform = computed(() => {
  const scaleRatio = zoom.value / baseZoom.value
  return `translate(-50%, -50%) scale(${scaleRatio}) rotate(${rotation.value}deg) translate(${translateX.value / scaleRatio}px, ${translateY.value / scaleRatio}px)`
})

/** 是否已点赞 */
const isFavorited = computed(() => props.photo?.isLiked ?? false)

/** 是否已收藏 */
const isCollected = computed(() => props.photo?.isCollected ?? false)

/** 是否是照片上传者 */
const isOwner = computed(() => {
  if (!props.photo || !authStore.userId) return false
  return props.photo.userId === authStore.userId
})

// ---- 缩放控制 ----
function zoomIn() {
  const step = baseZoom.value * ZOOM_RATIO_STEP
  zoom.value = Math.min(zoom.value + step, baseZoom.value * ZOOM_RATIO_MAX)
}

function zoomOut() {
  const step = baseZoom.value * ZOOM_RATIO_STEP
  zoom.value = Math.max(zoom.value - step, baseZoom.value * ZOOM_RATIO_MIN)
}

// ---- 图片加载后计算适配尺寸 ----
function handleImageLoad(event: Event) {
  const img = event.target as HTMLImageElement
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return

  // 可用区域（减去工具栏和边距空间）
  const availW = window.innerWidth - 80
  const availH = window.innerHeight - 120

  const scale = Math.min(availW / naturalW, availH / naturalH)
  imageWidth.value = Math.round(naturalW * scale)
  imageHeight.value = Math.round(naturalH * scale)

  // 设置初始缩放为适配缩放
  baseZoom.value = scale
  zoom.value = scale
  rotation.value = 0

  // 图片加载完成
  imageLoading.value = false
}

// ---- 监听 photo 变化，重置加载状态 ----
watch(() => props.photo, () => {
  imageLoading.value = true
})

// ---- 旋转控制（每次 90°） ----
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

// ---- 重置缩放、旋转和位置 ----
function resetView() {
  zoom.value = baseZoom.value
  rotation.value = 0
  translateX.value = 0
  translateY.value = 0
}

// ---- 拖拽控制（鼠标） ----
function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return // 只响应左键
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
  event.preventDefault()
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  translateX.value = dragStartTranslateX.value + dx
  translateY.value = dragStartTranslateY.value + dy
}

function handleMouseUp() {
  isDragging.value = false
}

// ---- 拖拽控制（触摸） ----
function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return // 只响应单指触摸
  const touch = event.touches[0]!
  isDragging.value = true
  dragStartX.value = touch.clientX
  dragStartY.value = touch.clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
}

function handleTouchMove(event: TouchEvent) {
  if (!isDragging.value || event.touches.length !== 1) return
  const touch = event.touches[0]!
  const dx = touch.clientX - dragStartX.value
  const dy = touch.clientY - dragStartY.value
  translateX.value = dragStartTranslateX.value + dx
  translateY.value = dragStartTranslateY.value + dy
  event.preventDefault()
}

function handleTouchEnd() {
  isDragging.value = false
}

// ---- 点赞切换 ----
async function toggleFavorite() {
  if (!props.photo) return
  const wasLiked = isFavorited.value
  try {
    if (wasLiked) {
      await photoApi.like.unlikePhoto(props.photo.id)
    } else {
      await photoApi.like.likePhoto(props.photo.id)
    }
    // 通知父组件更新状态
    emit('like', props.photo.id, !wasLiked)
  } catch (error) {
    console.error('点赞操作失败:', error)
  }
}

// ---- 收藏夹选择器切换 ----
function toggleCollect() {
  showCollectionSelector.value = !showCollectionSelector.value
}

// ---- 评论抽屉切换 ----
function toggleComments() {
  showComments.value = !showComments.value
}

// ---- 查看原图 ----
function viewOriginal() {
  if (!props.photo?.originalToken) return

  // 如果已经显示原图，切换回预览图
  if (showOriginal.value) {
    triggerRefreshAnimation(() => {
      showOriginal.value = false
    })
    return
  }

  // 如果原图已缓存，直接切换
  if (originalUrl.value) {
    triggerRefreshAnimation(() => {
      showOriginal.value = true
    })
    return
  }

  // 否则加载原图
  loadingOriginal.value = true
  const url = photoApi.getImgUrl(props.photo.originalToken)
  const img = new Image()
  img.onload = () => {
    originalUrl.value = url
    loadingOriginal.value = false
    triggerRefreshAnimation(() => {
      showOriginal.value = true
    })
  }
  img.onerror = () => {
    loadingOriginal.value = false
    console.error('原图加载失败')
  }
  img.src = url
}

// ---- 触发刷新动画 ----
function triggerRefreshAnimation(callback: () => void) {
  refreshing.value = true
  // 延迟切换，让动画开始
  setTimeout(() => {
    callback()
    // 动画结束后移除动画类
    setTimeout(() => {
      refreshing.value = false
    }, 800)
  }, 50)
}

// ---- 下载原图 ----
async function downloadOriginal() {
  if (!props.photo) return
  const token = props.photo.originalToken || props.photo.previewToken || props.photo.thumbnailToken
  if (!token) return

  try {
    const url = photoApi.getImgUrl(token)
    const loginResult = localStorage.getItem('MemorySeek.loginResult')
    const accessToken = localStorage.getItem('MemorySeek.accessToken')
    const headers: Record<string, string> = {}
    if (loginResult && accessToken) {
      const { user } = JSON.parse(loginResult)
      headers['Authorization'] = `Bearer ${user.id} ${accessToken}`
    }
    const response = await fetch(url, { headers })
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = props.photo.name || 'photo.jpg'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('下载失败:', error)
  }
}

// ---- 删除照片 ----
async function handleDelete() {
  if (!props.photo) return
  deleting.value = true
  try {
    await photoApi.deletePhotos([props.photo.id])
    toast.success('照片已删除')
    emit('delete', props.photo.id)
    showDeleteConfirm.value = false
    close()
  } catch (error) {
    console.error('删除照片失败:', error)
    toast.error('删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

// ---- 滚轮缩放 ----
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

// ---- 键盘快捷键 ----
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
    return
  }
  switch (event.key) {
    case 'Escape':
      close()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case 'r':
    case 'R':
      rotate()
      break
    case '0':
      resetView()
      break
    case 'o':
    case 'O':
      viewOriginal()
      break
    case 'd':
    case 'D':
      downloadOriginal()
      break
    case 'b':
    case 'B':
      toggleCollect()
      break
  }
}

// ---- 关闭弹窗 ----
function close() {
  emit('update:modelValue', false)
}

// ---- 点击背景关闭（只在点击空白区域时触发） ----
function handleContentClick(event: MouseEvent) {
  // 只有直接点击 content 元素本身时才关闭（不包括子元素）
  if (event.target === event.currentTarget) {
    close()
  }
}

// ---- 重置内部状态 ----
function resetState() {
  zoom.value = 1
  baseZoom.value = 1
  rotation.value = 0
  translateX.value = 0
  translateY.value = 0
  imageWidth.value = 0
  imageHeight.value = 0
  showComments.value = false
  showCollectionSelector.value = false
  showOriginal.value = false
  loadingOriginal.value = false
  refreshing.value = false
  originalUrl.value = null
  showDeleteConfirm.value = false
  deleting.value = false
  isDragging.value = false
}

// 监听弹窗打开，添加键盘和拖拽事件
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      resetState()
    }
  },
)

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="photo-viewer"
      @click="handleContentClick"
      @keydown="handleKeydown"
      tabindex="0"
    >
      <!-- 加载提示 -->
      <div v-if="imageLoading" class="photo-viewer__loading">
        <div class="photo-viewer__loading-spinner"></div>
      </div>

      <!-- 图片 -->
      <div
        v-if="imageUrl"
        class="photo-viewer__image-wrapper"
        :class="{ 'photo-viewer__image-wrapper--refreshing': refreshing }"
      >
        <img
          :key="showOriginal ? 'original' : 'preview'"
          :src="imageUrl"
          :alt="photo?.name"
          class="photo-viewer__image"
          :class="{
            'photo-viewer__image--dragging': isDragging,
            'photo-viewer__image--loaded': !imageLoading,
          }"
          :style="{ transform: imageTransform, width: imageWidth ? imageWidth + 'px' : undefined, height: imageHeight ? imageHeight + 'px' : undefined }"
          draggable="false"
          @load="handleImageLoad"
          @wheel.prevent="handleWheel"
          @mousedown="handleMouseDown"
          @touchstart="handleTouchStart"
          @touchmove.prevent="handleTouchMove"
          @touchend="handleTouchEnd"
        />
      </div>
      <div v-else class="photo-viewer__empty">
        图片加载失败
      </div>

      <!-- 底部工具栏 -->
      <PhotoToolbar
        v-show="!showComments"
        :zoom="zoom"
        :rotation="rotation"
        :is-favorited="isFavorited"
        :is-collected="isCollected"
        :show-original="showOriginal"
        :loading-original="loadingOriginal"
        :has-original-token="hasOriginalToken"
        :is-owner="isOwner"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @rotate="rotate"
        @reset="resetView"
        @toggle-favorite="toggleFavorite"
        @toggle-collect="toggleCollect"
        @toggle-comments="toggleComments"
        @view-original="viewOriginal"
        @download="downloadOriginal"
        @delete="showDeleteConfirm = true"
      />

      <!-- 侧边评论抽屉 -->
      <PhotoComments
        v-if="photo"
        :photo-id="photo.id"
        :visible="showComments"
        @close="showComments = false"
      />

      <!-- 收藏夹选择器 -->
      <CollectionSelector
        v-if="photo"
        v-model="showCollectionSelector"
        :photo-id="photo.id"
        overlay-class="photo-viewer__modal-overlay"
      />

      <!-- 删除确认弹窗 -->
      <Modal v-model="showDeleteConfirm" size="sm" title="删除照片" overlay-class="photo-viewer__modal-overlay">
        <div class="delete-confirm">
          <p class="delete-confirm__text">
            确定要删除这张照片吗？此操作不可撤销。
          </p>
          <div class="delete-confirm__actions">
            <button class="delete-confirm__cancel" type="button" @click="showDeleteConfirm = false">
              取消
            </button>
            <button class="delete-confirm__delete" type="button" :disabled="deleting" @click="handleDelete">
              {{ deleting ? '删除中...' : '删除' }}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  </Teleport>
</template>
