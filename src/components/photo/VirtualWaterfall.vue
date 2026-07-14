<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

/**
 * 瀑布流项目接口
 */
export interface WaterfallItem {
  id: string | number
  width: number
  height: number
  [key: string]: any
}

/**
 * 瀑布流分组接口
 */
export interface WaterfallGroup {
  key: string           // 分组标识，如 "2026-06"
  label: string         // 显示文本，如 "2026年6月"
  items: WaterfallItem[]
}

const props = withDefaults(
  defineProps<{
    items?: WaterfallItem[]           // 无分组模式
    groups?: WaterfallGroup[]         // 分组模式
    columnCount: number
    containerWidth: number
    gap?: number
    buffer?: number
    groupHeaderHeight?: number        // 分组标题高度
  }>(),
  {
    gap: 16,
    buffer: 800,
    groupHeaderHeight: 48,
  },
)

const emit = defineEmits<{
  (e: 'top-item-change', item: WaterfallItem): void
  (e: 'current-group-change', key: string): void
}>()

// 视口高度
const windowHeight = ref(window.innerHeight)
// 滚动位置
const scrollY = ref(0)
// 容器 ref
const waterfallRef = ref<HTMLElement | null>(null)

/**
 * 定位后的项目（照片或分组标题）
 */
interface PositionedItem {
  id: string | number
  type: 'item' | 'header'
  groupKey?: string         // 分组标题的 key
  groupLabel?: string       // 分组标题的文本
  renderTop: number
  renderLeft: number
  renderWidth: number
  renderHeight: number
  [key: string]: any
}

/**
 * 计算每张照片的绝对定位坐标
 */
const positionedItems = computed<PositionedItem[]>(() => {
  const _containerWidth = props.containerWidth

  if (_containerWidth <= 0) return []

  const colWidth = (_containerWidth - (props.columnCount - 1) * props.gap) / props.columnCount
  const heights = new Array(props.columnCount).fill(0)

  // 分组模式
  if (props.groups && props.groups.length > 0) {
    const result: PositionedItem[] = []

    for (const group of props.groups) {
      // 分组标题：占满整行
      const headerTop = Math.max(...heights)
      result.push({
        id: `header-${group.key}`,
        type: 'header',
        groupKey: group.key,
        groupLabel: group.label,
        renderTop: headerTop,
        renderLeft: 0,
        renderWidth: props.containerWidth,
        renderHeight: props.groupHeaderHeight,
      })
      heights.fill(headerTop + props.groupHeaderHeight + props.gap)

      // 组内照片
      for (const item of group.items) {
        const minHeight = Math.min(...heights)
        const minIndex = heights.indexOf(minHeight)
        const ratio = (item.height || 100) / (item.width || 100)
        const displayHeight = colWidth * ratio

        result.push({
          ...item,
          type: 'item',
          renderTop: minHeight,
          renderLeft: minIndex * (colWidth + props.gap),
          renderHeight: displayHeight,
          renderWidth: colWidth,
        })

        heights[minIndex] += displayHeight + props.gap
      }
    }

    return result
  }

  // 无分组模式（原有逻辑）
  if (props.items) {
    return props.items.map((item) => {
      const minHeight = Math.min(...heights)
      const minIndex = heights.indexOf(minHeight)
      const ratio = (item.height || 100) / (item.width || 100)
      const displayHeight = colWidth * ratio

      const pos: PositionedItem = {
        ...item,
        type: 'item',
        renderTop: minHeight,
        renderLeft: minIndex * (colWidth + props.gap),
        renderHeight: displayHeight,
        renderWidth: colWidth,
      }

      heights[minIndex] += displayHeight + props.gap
      return pos
    })
  }

  return []
})

/**
 * 虚拟滚动：只渲染视口内的元素
 */
const visibleItems = computed(() => {
  const start = scrollY.value - props.buffer
  const end = scrollY.value + windowHeight.value + props.buffer

  return positionedItems.value.filter(
    (p) => p.renderTop + p.renderHeight > start && p.renderTop < end,
  )
})

/**
 * 跟踪最顶部的分组并触发事件（从 computed 中抽离，避免副作用）
 */
watch(visibleItems, (filtered) => {
  if (filtered.length === 0) return

  const topItem = filtered.reduce((prev, curr) =>
    prev.renderTop < curr.renderTop ? prev : curr,
  )

  let currentGroupKey = ''
  if (topItem.type === 'header') {
    currentGroupKey = topItem.groupKey || ''
  } else {
    // 找 renderTop <= topItem.renderTop 中最大的那个 header
    const headerItem = positionedItems.value
      .filter(p => p.type === 'header' && p.groupKey && p.renderTop <= topItem.renderTop)
      .reduce((best, curr) => (!best || curr.renderTop > best.renderTop ? curr : best), null as PositionedItem | null)
    currentGroupKey = headerItem?.groupKey || ''
  }

  if (currentGroupKey) {
    emit('current-group-change', currentGroupKey)
  }

  if (topItem.type === 'item') {
    emit('top-item-change', topItem as unknown as WaterfallItem)
  }
})

/**
 * 容器总高度（撑开父容器）
 */
const containerHeight = computed(() => {
  if (positionedItems.value.length === 0) return 100
  return positionedItems.value.reduce(
    (max, p) => Math.max(max, p.renderTop + p.renderHeight), 0,
  )
})

/**
 * 滚动事件处理
 */
function handleScroll() {
  scrollY.value = window.scrollY
}

/**
 * 窗口大小变化处理
 */
function handleResize() {
  windowHeight.value = window.innerHeight
}

/**
 * 滚动到指定分组
 */
function scrollToGroup(groupKey: string) {
  const header = positionedItems.value.find(
    p => p.type === 'header' && p.groupKey === groupKey,
  )
  if (!header) {
    console.warn(`scrollToGroup: 未找到分组 ${groupKey}，当前分组:`, positionedItems.value.filter(p => p.type === 'header').map(p => p.groupKey))
    return
  }

  if (!waterfallRef.value) {
    console.warn('scrollToGroup: 容器 ref 未就绪')
    return
  }
  const containerRect = waterfallRef.value.getBoundingClientRect()
  const scrollTop = containerRect.top + window.scrollY + header.renderTop
  window.scrollTo({
    top: scrollTop,
    behavior: 'smooth',
  })
}

defineExpose({ scrollToGroup })

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="virtual-waterfall" ref="waterfallRef" :style="{ height: containerHeight + 'px' }">
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="waterfall-item"
      :class="{ 'waterfall-item--header': item.type === 'header' }"
      :style="{
        width: `${item.renderWidth}px`,
        height: `${item.renderHeight}px`,
        transform: `translate3d(${item.renderLeft}px, ${item.renderTop}px, 0)`,
      }"
    >
      <!-- 分组标题 -->
      <slot
        v-if="item.type === 'header'"
        name="header"
        :group="{ key: item.groupKey, label: item.groupLabel }"
      />
      <!-- 照片卡片 -->
      <slot v-else :item="item" />
    </div>
  </div>
</template>

<style scoped>
.virtual-waterfall {
  position: relative;
  width: 100%;
}

.waterfall-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 0.3s var(--ease-out);
}

.waterfall-item--header {
  z-index: 1;
}
</style>
