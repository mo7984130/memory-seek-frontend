<!-- src/components/photo/PhotoViewer.vue -->
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { photo as photoApi } from 'memory-seek-api'
import type { PhotoResult } from 'memory-seek-api'
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
  'favorite': [photoId: string]
}>()

// ---- 状态 ----
const zoom = ref(1)
const rotation = ref(0)
const showComments = ref(false)
const showOriginal = ref(false)
const loadingOriginal = ref(false)
const refreshing = ref(false)

// 原图缓存（仅当前会话有效）
const originalUrl = ref<string | null>(null)

// 缩放范围常量
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

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

/** 图片 transform 样式 */
const imageTransform = computed(() => {
  return `scale(${zoom.value}) rotate(${rotation.value}deg)`
})

/** 是否已收藏 */
const isFavorited = computed(() => props.photo?.isFavorited ?? false)

// ---- 缩放控制 ----
function zoomIn() {
  zoom.value = Math.min(zoom.value + ZOOM_STEP, ZOOM_MAX)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - ZOOM_STEP, ZOOM_MIN)
}

// ---- 旋转控制（每次 90°） ----
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

// ---- 收藏切换 ----
async function toggleFavorite() {
  if (!props.photo) return
  try {
    // 获取收藏夹列表
    const collectionRes = await photoApi.collection.getCollectionList()
    const favoriteCollection = collectionRes.data.find((c) => c.isFavorite)
    if (!favoriteCollection) {
      console.error('未找到默认收藏夹')
      return
    }

    if (isFavorited.value) {
      await photoApi.collection.removePhotoFromCollection(favoriteCollection.id, props.photo.id)
    } else {
      await photoApi.collection.addPhotosToCollection(favoriteCollection.id, [props.photo.id])
    }

    // 通知父组件更新状态
    emit('favorite', props.photo.id)
  } catch (error) {
    console.error('收藏操作失败:', error)
  }
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
    case 'o':
    case 'O':
      viewOriginal()
      break
    case 'd':
    case 'D':
      downloadOriginal()
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
  rotation.value = 0
  showComments.value = false
  showOriginal.value = false
  loadingOriginal.value = false
  refreshing.value = false
  originalUrl.value = null
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
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="photo-viewer"
      @wheel.prevent="handleWheel"
      @click.self="handleContentClick"
      @keydown="handleKeydown"
      tabindex="0"
    >
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
          :style="{ transform: imageTransform }"
          draggable="false"
        />
      </div>
      <div v-else class="photo-viewer__empty">
        图片加载失败
      </div>

      <!-- 底部工具栏 -->
      <PhotoToolbar
        :zoom="zoom"
        :rotation="rotation"
        :is-favorited="isFavorited"
        :show-original="showOriginal"
        :loading-original="loadingOriginal"
        :has-original-token="hasOriginalToken"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @rotate="rotate"
        @toggle-favorite="toggleFavorite"
        @toggle-comments="toggleComments"
        @view-original="viewOriginal"
        @download="downloadOriginal"
      />

      <!-- 侧边评论抽屉 -->
      <PhotoComments
        v-if="photo"
        :photo-id="photo.id"
        :visible="showComments"
        @close="showComments = false"
      />
    </div>
  </Teleport>
</template>
