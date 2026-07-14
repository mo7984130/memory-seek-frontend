<!-- 瀑布流容器组件 - 自动管理状态持久化 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useWaterfallPersistence } from '@/composables/useWaterfallPersistence'
import type { WaterfallGroup } from './VirtualWaterfall.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'

interface Props {
  /** 存储键名，用于区分不同页面的状态 */
  storageKey: string
  /** 瀑布流分组数据 */
  groups: WaterfallGroup[]
  /** 是否正在加载 */
  loading?: boolean
  /** 是否有更多数据 */
  hasMore?: boolean
  /** 列数 */
  columnCount?: number
  /** 容器宽度 */
  containerWidth?: number
  /** 间距 */
  gap?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasMore: true,
  columnCount: 4,
  containerWidth: 0,
  gap: 16,
})

const emit = defineEmits<{
  'load-more': []
  'current-group-change': [group: string]
}>()

// 使用持久化 composable
const waterfall = useWaterfallPersistence(props.storageKey)

// 本地 UI 状态
const containerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)


// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !props.loading && props.hasMore) {
    emit('load-more')
  }
})

// 暴露 waterfall 方法给父组件
defineExpose({
  waterfall,
  containerRef,
})
</script>

<template>
  <div class="waterfall-view" ref="containerRef">
    <slot
      name="default"
      :waterfall="waterfall"
      :container-ref="containerRef"
    />

    <!-- 加载指示器 -->
    <div ref="sentinelRef" class="waterfall-view__sentinel">
      <Spinner v-if="loading" />
      <slot name="empty" v-else-if="!loading && waterfall.allPhotos.value.length === 0" />
      <span v-else-if="!hasMore" class="waterfall-view__end">已经到底啦 ~</span>
    </div>
  </div>
</template>

<style scoped>
.waterfall-view {
  position: relative;
  width: 100%;
}

.waterfall-view__sentinel {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-tertiary);
}

.waterfall-view__end {
  font-size: var(--text-sm);
  position: relative;
}

.waterfall-view__end::before,
.waterfall-view__end::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-border));
}

.waterfall-view__end::before {
  right: calc(100% + 12px);
}

.waterfall-view__end::after {
  left: calc(100% + 12px);
  background: linear-gradient(90deg, var(--color-border), transparent);
}
</style>
