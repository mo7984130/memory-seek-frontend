<!-- 回到上次浏览位置 悬浮按钮（右上角，按钮触发恢复） -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWaterfallPersistence } from '@/composables/useWaterfallPersistence'
import { History } from '@/components/base/Icon/icons'

const props = defineProps<{
  /** 与对应页面一致的存储键名（photos / likes / collection-<id>） */
  storageKey: string
}>()

const emit = defineEmits<{
  (e: 'restore'): void
}>()

const waterfall = useWaterfallPersistence(props.storageKey)

const visible = ref(false)

/**
 * 点击：通知页面执行 cursor 恢复，并隐藏按钮
 */
function handleClick() {
  emit('restore')
  visible.value = false
}

onMounted(() => {
  // 存在可恢复的位置时才显示：
  // - cursor 非空：上次浏览位置在某页
  // - cursor 为空但有 anchorTime：上次在时间线列表第 0 页，可按锚点恢复
  const saved = waterfall.getSavedPosition()
  if (!saved) return
  if (saved.cursor == null && !saved.anchorTime) return

  visible.value = true
})
</script>

<template>
  <Transition name="last-pos">
    <button
      v-if="visible"
      class="last-pos-btn"
      type="button"
      title="回到上次浏览位置"
      @click="handleClick"
    >
      <History :size="16" />
      <span class="last-pos-btn__text">回到上次浏览位置</span>
    </button>
  </Transition>
</template>

<style scoped>
.last-pos-btn {
  position: fixed;
  right: var(--spacing-6);
  /* 避开顶部固定导航栏（56px） */
  top: calc(56px + var(--spacing-4));
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--color-primary);
  color: #fff;
  border: none;
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

.last-pos-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.last-pos-btn:active {
  transform: scale(0.96);
}

.last-pos-btn__text {
  white-space: nowrap;
}

/* 进入/离开动画 */
.last-pos-enter-active,
.last-pos-leave-active {
  transition:
    opacity var(--transition-fast) var(--ease-out),
    transform var(--transition-fast) var(--ease-out);
}

.last-pos-enter-from,
.last-pos-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .last-pos-btn {
    right: var(--spacing-4);
  }
}
</style>
