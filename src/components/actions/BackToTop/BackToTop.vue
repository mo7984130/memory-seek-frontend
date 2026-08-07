<!-- 回到顶部 悬浮按钮 -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { ArrowUp } from "@/components/base/Icon/icons";

const visible = ref(false);

function handleScroll() {
  visible.value = window.scrollY > 400;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <Transition name="back-to-top">
    <button
      v-if="visible"
      class="back-to-top"
      type="button"
      title="回到顶部"
      @click="scrollToTop"
    >
      <ArrowUp :size="16" />
      <span class="back-to-top__text">回到顶部</span>
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: var(--spacing-6);
  bottom: var(--spacing-6);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  z-index: var(--z-index-sticky);
  transition:
    background var(--transition-fast) var(--ease-out),
    transform var(--transition-fast-out);
}

.back-to-top:hover {
  background: var(--color-bg-hover);
  transform: translateY(-1px);
}

.back-to-top:active {
  transform: scale(0.96);
}

.back-to-top__text {
  white-space: nowrap;
}

/* 进入/离开动画 */
.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity var(--transition-fast) var(--ease-out),
    transform var(--transition-fast) var(--ease-out);
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 768px) {
  /* 移动端：避免与右下角时间线 FAB 重叠，悬停在它上方 */
  .back-to-top {
    right: var(--spacing-4);
    bottom: 76px;
  }
}
</style>
