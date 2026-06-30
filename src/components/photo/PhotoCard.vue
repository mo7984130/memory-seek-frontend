<script setup lang="ts">
import { computed } from 'vue'
import { LikeIcon, PhotoIcon } from '@/components/base/Icon/icons'
import { photo, type PhotoResult } from 'memory-seek-api'

const props = defineProps<{
  item: PhotoResult
}>()

const emit = defineEmits<{
  (e: 'click', item: PhotoResult): void
  (e: 'like', item: PhotoResult): void
}>()

/**
 * 缩略图 URL
 */
const thumbnailUrl = computed(() => {
  if (props.item.thumbnailToken) return photo.getImgUrl(props.item.thumbnailToken)
  return null
})

/**
 * 是否已点赞
 */
const isLiked = computed(() => props.item.isLiked ?? false)

/**
 * 点击处理
 */
function handleClick() {
  emit('click', props.item)
}

/**
 * 点赞/取消点赞
 */
function handleLike(event: Event) {
  event.stopPropagation()
  emit('like', props.item)
}
</script>

<template>
  <div class="photo-card" @click="handleClick">
    <!-- 图片容器 -->
    <div class="photo-card__image-wrapper">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="photo-card__image"
        loading="lazy"
      />
      <div v-else class="photo-card__placeholder">
        <PhotoIcon :size="32" />
      </div>

      <!-- 点赞按钮 -->
      <button
        class="photo-card__like-btn"
        :class="{ 'photo-card__like-btn--active': isLiked }"
        @click="handleLike"
        title="点赞"
      >
        <LikeIcon :size="18" :fill="isLiked ? 'currentColor' : 'none'" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-card);
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .photo-card {
  border-color: rgba(255, 255, 255, 0.08);
}

@media (hover: hover) and (pointer: fine) {
  .photo-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.1);
  }

  .dark .photo-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 8px 32px rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .photo-card:hover .photo-card__image {
    transform: scale(1.03);
  }
}

.photo-card:active {
  transform: scale(0.99);
}

.photo-card__image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.photo-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s var(--ease-out);
}

.photo-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
}

.photo-card__like-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.photo-card__like-btn:hover {
  transform: scale(1.1);
}

.photo-card__like-btn:active {
  transform: scale(0.95);
}

.photo-card__like-btn--active {
  color: var(--color-like, #ef4444);
}
</style>
