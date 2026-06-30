<script setup lang="ts">
import { computed } from 'vue'
import { LikeIcon, PhotoIcon } from '@/components/base/Icon/icons'
import { photo, type PhotoResult } from 'memory-seek-api'
import dayjs from 'dayjs'

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
 * 格式化日期
 */
const formattedDate = computed(() => {
  return dayjs(props.item.createdAt).format('YYYY/MM/DD')
})

/**
 * 图片尺寸比例
 */
const aspectRatio = computed(() => {
  if (props.item.width && props.item.height) {
    return props.item.width / props.item.height
  }
  return 4 / 3
})

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

      <!-- 渐变遮罩 -->
      <div class="photo-card__overlay" />

      <!-- 底部信息 -->
      <div class="photo-card__info">
        <span class="photo-card__name">{{ item.name }}</span>
        <span class="photo-card__date">{{ formattedDate }}</span>
      </div>

      <!-- 点赞按钮 -->
      <button
        class="photo-card__like-btn"
        :class="{ 'photo-card__like-btn--active': isLiked }"
        @click="handleLike"
        title="点赞"
      >
        <div class="photo-card__like-bg" />
        <LikeIcon :size="16" :fill="isLiked ? 'currentColor' : 'none'" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-card);
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .photo-card {
  border-color: rgba(255, 255, 255, 0.08);
}

@media (hover: hover) and (pointer: fine) {
  .photo-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.1);
  }

  .dark .photo-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 16px 48px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .photo-card:hover .photo-card__image {
    transform: scale(1.05);
  }

  .photo-card:hover .photo-card__overlay {
    opacity: 1;
  }

  .photo-card:hover .photo-card__info {
    opacity: 1;
    transform: translateY(0);
  }
}

.photo-card:active {
  transform: scale(0.98);
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
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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

/* 渐变遮罩 */
.photo-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0.2) 40%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.dark .photo-card__overlay {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.3) 40%,
    transparent 100%
  );
}

/* 底部信息 */
.photo-card__info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.3s ease;
}

.photo-card__name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-card__date {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 点赞按钮 */
.photo-card__like-btn {
  position: absolute;
  top: var(--spacing-3);
  right: var(--spacing-3);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  opacity: 1;
  z-index: 1;
}

.photo-card__like-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.photo-card__like-btn:hover .photo-card__like-bg {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.photo-card__like-btn:active .photo-card__like-bg {
  transform: scale(0.95);
}

.photo-card__like-btn--active {
  color: var(--color-like, #ef4444);
  opacity: 1;
}

.photo-card__like-btn--active .photo-card__like-bg {
  background: rgba(255, 255, 255, 0.9);
}

/* 移动端始终显示 */
@media (hover: none) {
  .photo-card__overlay {
    opacity: 1;
  }

  .photo-card__info {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
