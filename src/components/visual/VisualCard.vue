<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { LikeIcon, PlayIcon, VisualIcon } from "@/components/base/Icon/icons";
import type { Visual } from "memory-seek-api";
import { useVisualSrc } from "@/composables/useVisualSrc";
import dayjs from "dayjs";

const props = defineProps<{
  item: Visual;
}>();

const emit = defineEmits<{
  (e: "click", item: Visual): void;
  (e: "like", item: Visual): void;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);
/** 是否悬停在卡片上（用于就绪后自动开始播放） */
const hovering = ref(false);
/** 是否正在悬停播放（用于隐藏播放按钮） */
const playing = ref(false);

/**
 * 缩略图地址与就绪状态
 *
 * 直接渲染 token URL；视频缩略片在转码完成前返回 202（空 body），
 * 媒体元素加载失败时由 useVisualSrc 探测分类并按 Retry-After 重试。
 */
const { src, status, isVideo, handleLoaded, handleError } = useVisualSrc({
  token: () => props.item.thumbnailToken,
  type: () => (props.item.kind === "Video" ? "video" : "image"),
  waitForTranscode: () => props.item.kind === "Video",
});

/** 占位层是否显示（无媒体 / 转码中 / 失败；视频加载首帧前也显示） */
const showPlaceholder = computed(() => {
  if (!src.value) return true;
  if (status.value === "transcoding" || status.value === "error") return true;
  return isVideo.value && status.value === "loading";
});

/** 占位层是否显示加载动画（加载中 / 转码中） */
const isPending = computed(
  () => status.value === "loading" || status.value === "transcoding",
);

/** 视频地址：附加起始时间片段，确保未播放时也能渲染出首帧而非黑屏 */
const videoSrc = computed(() => (src.value ? `${src.value}#t=0.001` : null));

/** 悬停播放，移出暂停并回到首帧（PC 与移动端一致，移动端无 hover 则显示首帧） */
function startPlayback() {
  const el = videoEl.value;
  if (!el) return;
  el.play()
    .then(() => {
      playing.value = true;
    })
    .catch(() => {});
}

function handleMouseEnter() {
  hovering.value = true;
  startPlayback();
}

function handleMouseLeave() {
  hovering.value = false;
  playing.value = false;
  const el = videoEl.value;
  if (!el) return;
  el.pause();
  el.currentTime = 0;
}

// 悬停期间视频就绪（转码完成）后自动开始播放
watch(
  () => src.value,
  () => {
    if (hovering.value && src.value) startPlayback();
  },
  { flush: "post" },
);

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
  <div
    class="visual-card"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 图片 / 视频容器 -->
    <div class="visual-card__image-wrapper">
      <video
        v-if="isVideo && videoSrc"
        ref="videoEl"
        :src="videoSrc"
        class="visual-card__image"
        muted
        loop
        playsinline
        preload="metadata"
        @loadedmetadata="handleLoaded"
        @error="handleError"
      />
      <img
        v-else-if="src"
        :src="src"
        :alt="item.name"
        class="visual-card__image"
        loading="lazy"
        @load="handleLoaded"
        @error="handleError"
      />
      <div v-if="showPlaceholder" class="visual-card__placeholder">
        <div v-if="isPending" class="visual-card__spinner" />
        <VisualIcon v-else :size="32" />
      </div>

      <!-- 视频播放标记 -->
      <span
        v-if="isVideo && status === 'ready' && !playing"
        class="visual-card__play"
      >
        <PlayIcon :size="18" fill="currentColor" />
      </span>

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
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
}

.visual-card__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0, 0, 0, 0.08);
  border-top-color: var(--color-text-tertiary);
  border-radius: 50%;
  animation: visual-card-spin 0.8s linear infinite;
}

.dark .visual-card__spinner {
  border-color: rgba(255, 255, 255, 0.15);
  border-top-color: var(--color-text-tertiary);
}

@keyframes visual-card-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 视频播放标记 */
.visual-card__play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1;
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
