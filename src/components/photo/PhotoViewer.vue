<!-- src/components/photo/PhotoViewer.vue -->
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { photo as photoApi } from 'memory-seek-api'
import type { PhotoResult } from 'memory-seek-api'
import Modal from '@/components/feedback/Modal/Modal.vue'
import PhotoToolbar from './PhotoToolbar.vue'
import PhotoComments from './PhotoComments.vue'

interface Props {
  modelValue: boolean
  photo: PhotoResult | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'favorite': [photoId: string]
}>()

// 内部状态
const zoom = ref(1)
const rotation = ref(0)
const showComments = ref(false)

// 缩放范围常量
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

/**
 * 图片 URL（优先 previewToken，降级到 thumbnailToken）
 */
const imageUrl = computed(() => {
  if (!props.photo) return null
  const token = props.photo.previewToken || props.photo.thumbnailToken
  if (!token) return null
  return photoApi.getImgUrl(token)
})

/**
 * 图片 transform 样式
 */
const imageTransform = computed(() => {
  return `scale(${zoom.value}) rotate(${rotation.value}deg)`
})

/**
 * 是否已收藏
 */
const isFavorited = computed(() => props.photo?.isFavorited ?? false)

/**
 * 缩放控制
 */
function zoomIn() {
  zoom.value = Math.min(zoom.value + ZOOM_STEP, ZOOM_MAX)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - ZOOM_STEP, ZOOM_MIN)
}

/**
 * 旋转控制（每次 90°）
 */
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

/**
 * 收藏切换
 */
async function toggleFavorite() {
  if (!props.photo) return
  try {
    // 使用默认收藏夹（isFavorite=true 的那个）
    // TODO: 需要确认收藏 API 的具体调用方式
    emit('favorite', props.photo.id)
  } catch (error) {
    console.error('收藏操作失败:', error)
  }
}

/**
 * 评论抽屉切换
 */
function toggleComments() {
  showComments.value = !showComments.value
}

/**
 * 滚轮缩放
 */
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

/**
 * 键盘快捷键
 */
function handleKeydown(event: KeyboardEvent) {
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
  }
}

/**
 * 关闭弹窗
 */
function close() {
  emit('update:modelValue', false)
}

/**
 * Modal 关闭时重置状态
 */
function handleModalClose(value: boolean) {
  emit('update:modelValue', value)
  if (!value) {
    resetState()
  }
}

/**
 * 重置内部状态
 */
function resetState() {
  zoom.value = 1
  rotation.value = 0
  showComments.value = false
}

// 监听弹窗打开，添加键盘事件
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
      resetState()
    }
  },
)

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="full"
    :closable="false"
    :mask-closable="true"
    class="photo-viewer"
    @update:model-value="handleModalClose"
  >
    <div class="photo-viewer__content" @wheel.prevent="handleWheel">
      <!-- 图片 -->
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="photo?.name"
        class="photo-viewer__image"
        :style="{ transform: imageTransform }"
        draggable="false"
      />
      <div v-else class="photo-viewer__empty">
        图片加载失败
      </div>

      <!-- 底部工具栏 -->
      <PhotoToolbar
        :zoom="zoom"
        :rotation="rotation"
        :is-favorited="isFavorited"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @rotate="rotate"
        @toggle-favorite="toggleFavorite"
        @toggle-comments="toggleComments"
      />

      <!-- 侧边评论抽屉 -->
      <PhotoComments
        v-if="photo"
        :photo-id="photo.id"
        :visible="showComments"
        @close="showComments = false"
      />
    </div>
  </Modal>
</template>
