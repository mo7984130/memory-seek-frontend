<!-- src/components/photo/PhotoToolbar.vue -->
<script setup lang="ts">
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Heart, MessageCircle, PhotoIcon, Download, LoadingIcon, Trash2 } from '@/components/base/Icon/icons'
import './photo-toolbar.css'

interface Props {
  zoom: number
  rotation: number
  isFavorited?: boolean
  showOriginal?: boolean
  loadingOriginal?: boolean
  hasOriginalToken?: boolean
  isOwner?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'rotate': []
  'reset': []
  'toggle-favorite': []
  'toggle-comments': []
  'view-original': []
  'download': []
  'delete': []
}>()

function handleZoomIn() {
  emit('zoom-in')
}

function handleZoomOut() {
  emit('zoom-out')
}

function handleRotate() {
  emit('rotate')
}

function handleReset() {
  emit('reset')
}

function handleToggleFavorite() {
  emit('toggle-favorite')
}

function handleToggleComments() {
  emit('toggle-comments')
}

function handleViewOriginal() {
  emit('view-original')
}

function handleDownload() {
  emit('download')
}

function handleDelete() {
  emit('delete')
}
</script>

<template>
  <div class="photo-toolbar">
    <button class="photo-toolbar__btn" type="button" @click="handleZoomOut" title="缩小 (-)">
      <ZoomOut :size="20" />
    </button>
    <span class="photo-toolbar__zoom">{{ Math.round(zoom * 100) }}%</span>
    <button class="photo-toolbar__btn" type="button" @click="handleZoomIn" title="放大 (+)">
      <ZoomIn :size="20" />
    </button>
    <div class="photo-toolbar__divider" />
    <button class="photo-toolbar__btn" type="button" @click="handleRotate" title="旋转 (R)">
      <RotateCw :size="20" />
    </button>
    <button class="photo-toolbar__btn" type="button" @click="handleReset" title="重置 (0)">
      <Maximize2 :size="20" />
    </button>
    <div class="photo-toolbar__divider" />
    <button
      class="photo-toolbar__btn"
      :class="{ 'photo-toolbar__btn--active': isFavorited }"
      type="button"
      @click="handleToggleFavorite"
      title="收藏"
    >
      <Heart :size="20" :fill="isFavorited ? 'var(--color-like)' : 'none'" />
    </button>
    <button class="photo-toolbar__btn" type="button" @click="handleToggleComments" title="评论">
      <MessageCircle :size="20" />
    </button>
    <div class="photo-toolbar__divider" />
    <button
      v-if="hasOriginalToken"
      class="photo-toolbar__btn"
      :class="{ 'photo-toolbar__btn--active': showOriginal }"
      type="button"
      :disabled="loadingOriginal"
      @click="handleViewOriginal"
      :title="showOriginal ? '查看预览图 (O)' : '查看原图 (O)'"
    >
      <LoadingIcon v-if="loadingOriginal" :size="20" class="photo-toolbar__loading" />
      <PhotoIcon v-else :size="20" />
    </button>
    <button class="photo-toolbar__btn" type="button" @click="handleDownload" title="下载 (D)">
      <Download :size="20" />
    </button>
    <template v-if="isOwner">
      <div class="photo-toolbar__divider" />
      <button class="photo-toolbar__btn photo-toolbar__btn--danger" type="button" @click="handleDelete" title="删除">
        <Trash2 :size="20" />
      </button>
    </template>
  </div>
</template>
