<!-- src/components/photo/PhotoToolbar.vue -->
<script setup lang="ts">
import { ZoomIn, ZoomOut, RotateCw, Heart, MessageCircle } from 'lucide-vue-next'

interface Props {
  zoom: number
  rotation: number
  isFavorited: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'rotate': []
  'toggle-favorite': []
  'toggle-comments': []
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

function handleToggleFavorite() {
  emit('toggle-favorite')
}

function handleToggleComments() {
  emit('toggle-comments')
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
  </div>
</template>
