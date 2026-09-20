<script setup lang="ts">
import { computed } from "vue";
import { LikeIcon, VisualIcon } from "@/components/base/Icon/icons";
import { visual, type Visual } from "memory-seek-api";
import dayjs from "dayjs";

const props = defineProps<{
  item: Visual;
}>();

const emit = defineEmits<{
  (e: "click", item: Visual): void;
  (e: "like", item: Visual): void;
}>();

/**
 * 缩略图 URL
 */
const thumbnailUrl = computed(() => {
  if (props.item.thumbnailToken)
    return visual.getVisualUrl(props.item.thumbnailToken);
  return null;
});

/**
 * 是否已点赞
 */
const isLiked = computed(() => props.item.isLiked ?? false);

/**
 * 格式化日期
 */
const formattedDate = computed(() => {
  return dayjs(props.item.createdAt).format("YYYY/MM/DD");
});

/**
 * 点击处理
 */
function handleClick() {
  emit("click", props.item);
}

/**
 * 点赞/取消点赞
 */
function handleLike(event: Event) {
  event.stopPropagation();
  emit("like", props.item);
}
</script>

<template>
  <div class="visual-card" @click="handleClick">
    <!-- 图片容器 -->
    <div class="visual-card__image-wrapper">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="visual-card__image"
        loading="lazy"
      />
      <div v-else class="visual-card__placeholder">
        <VisualIcon :size="32" />
      </div>

      <!-- 渐变遮罩 -->
      <div class="visual-card__overlay" />

      <!-- 底部信息 -->
      <div class="visual-card__info">
        <span class="visual-card__date">{{ formattedDate }}</span>
      </div>

      <!-- 点赞按钮 -->
      <button
        class="visual-card__like-btn"
        :class="{ 'visual-card__like-btn--active': isLiked }"
        @click="handleLike"
        title="点赞"
      >
        <LikeIcon :size="18" :fill="isLiked ? 'currentColor' : 'none'" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.visual-card {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-card);
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .visual-card {
  border-color: rgba(255, 255, 255, 0.08);
}

@media (hover: hover) and (pointer: fine) {
  .visual-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 16px 48px rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.1);
  }

  .dark .visual-card:hover {
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.4),
      0 16px 48px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .visual-card:hover .visual-card__image {
    transform: scale(1.05);
  }

  .visual-card:hover .visual-card__overlay {
    opacity: 1;
  }

  .visual-card:hover .visual-card__info {
    opacity: 1;
    transform: translateY(0);
  }
}

.visual-card:active {
  transform: scale(0.98);
}

.visual-card__image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.visual-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.visual-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
}

/* 渐变遮罩 */
.visual-card__overlay {
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

.dark .visual-card__overlay {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.3) 40%,
    transparent 100%
  );
}

/* 底部信息 */
.visual-card__info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.3s ease;
}

.visual-card__date {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 点赞按钮 */
.visual-card__like-btn {
  position: absolute;
  top: var(--spacing-3);
  right: var(--spacing-3);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
  z-index: 1;
}

.visual-card__like-btn:hover {
  transform: scale(1.15);
}

.visual-card__like-btn:active {
  transform: scale(0.9);
}

.visual-card__like-btn--active {
  color: var(--color-like, #ef4444);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}

/* 移动端始终显示 */
@media (hover: none) {
  .visual-card__overlay {
    opacity: 1;
  }

  .visual-card__info {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
