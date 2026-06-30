<script setup lang="ts">
import { computed } from 'vue'
import type { MonthStat } from 'memory-seek-api'

/**
 * 导航年份结构
 */
interface NavYear {
  year: number
  months: { key: string; label: string }[]
}

const props = withDefaults(
  defineProps<{
    monthStats: MonthStat[]
    currentGroup: string
    navigating?: boolean
  }>(),
  { navigating: false },
)

const emit = defineEmits<{
  (e: 'navigate', groupKey: string): void
}>()

/**
 * 将 MonthStat 转换为导航结构
 */
const navYears = computed<NavYear[]>(() => {
  const yearMap = new Map<number, { key: string; label: string }[]>()

  for (const stat of props.monthStats) {
    const [yearStr, monthStr] = stat.dateStr.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)

    if (!yearMap.has(year)) {
      yearMap.set(year, [])
    }
    yearMap.get(year)!.push({
      key: stat.dateStr,
      label: `${month}月`,
    })
  }

  return Array.from(yearMap.entries()).map(([year, months]) => ({
    year,
    months,
  }))
})

/**
 * 点击月份处理
 */
function handleMonthClick(key: string) {
  if (props.navigating) return
  emit('navigate', key)
}
</script>

<template>
  <nav class="timeline-nav" v-if="navYears.length > 0">
    <!-- 加载指示器 -->
    <div v-if="navigating" class="timeline-nav__loading" title="加载中...">
      <span class="timeline-nav__spinner"></span>
    </div>
    <template v-for="year in navYears" :key="year.year">
      <!-- 年份标签 -->
      <div
        class="timeline-nav__year"
        :class="{
          'timeline-nav__year--active': year.months.some(m => m.key === currentGroup)
        }"
      >
        {{ year.year }}
      </div>
      <!-- 月份按钮 -->
      <button
        v-for="month in year.months"
        :key="month.key"
        class="timeline-nav__month"
        :class="{
          'timeline-nav__month--active': month.key === currentGroup,
          'timeline-nav__month--disabled': navigating,
        }"
        @click="handleMonthClick(month.key)"
        :title="`${year.year}年${month.label}`"
        :disabled="navigating"
      >
        {{ month.label }}
      </button>
    </template>
  </nav>
</template>

<style scoped>
.timeline-nav {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  padding: 8px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  overflow-y: auto;
  scrollbar-width: none;
  z-index: var(--z-index-sticky);
}

.timeline-nav::-webkit-scrollbar {
  display: none;
}

.timeline-nav__year {
  font-size: 9px;
  font-weight: var(--font-bold);
  color: var(--color-text-secondary);
  padding: 4px 2px;
  width: 100%;
  text-align: center;
  line-height: 1.2;
  user-select: none;
}

.timeline-nav__year--active {
  color: var(--color-primary);
}

.timeline-nav__month {
  font-size: 8px;
  padding: 3px 2px;
  width: 100%;
  text-align: center;
  border-radius: 3px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  background: transparent;
  border: none;
  transition: all var(--transition-fast) var(--ease-out);
  font-family: var(--font-sans);
  line-height: 1.2;
  user-select: none;
}

.timeline-nav__month:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.timeline-nav__month--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.timeline-nav__month--active {
  color: var(--color-primary);
  font-weight: var(--font-semibold);
  background: var(--color-primary-50);
}

.dark .timeline-nav__month--active {
  background: rgba(212, 175, 55, 0.15);
}

.timeline-nav__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.timeline-nav__spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-text-tertiary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: timeline-spin 0.6s linear infinite;
}

@keyframes timeline-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .timeline-nav {
    display: none;
  }
}
</style>
