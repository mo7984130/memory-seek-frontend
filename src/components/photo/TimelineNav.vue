<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MonthStat } from 'memory-seek-api'
import { Calendar } from '@/components/base/Icon/icons'
import Modal from '@/components/feedback/Modal/Modal.vue'

/**
 * 导航年份结构
 */
interface NavYear {
  year: number
  months: { key: string; label: string; count: number }[]
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

const showModal = ref(false)

/**
 * 将 MonthStat 转换为导航结构
 */
const navYears = computed<NavYear[]>(() => {
  const yearMap = new Map<number, { key: string; label: string; count: number }[]>()

  for (const stat of props.monthStats) {
    const parts = stat.dateStr.split('-')
    const year = parseInt(parts[0]!)
    const month = parseInt(parts[1]!)

    if (!yearMap.has(year)) {
      yearMap.set(year, [])
    }
    yearMap.get(year)!.push({
      key: stat.dateStr,
      label: `${month}月`,
      count: stat.count,
    })
  }

  return Array.from(yearMap.entries())
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, months]) => ({
      year,
      months: months.sort((a, b) => b.key.localeCompare(a.key)),
    }))
})

/**
 * 点击月份处理
 */
function handleMonthClick(key: string) {
  if (props.navigating) return
  emit('navigate', key)
  showModal.value = false
}
</script>

<template>
  <!-- 桌面端：右侧固定导航条 -->
  <nav class="timeline-nav timeline-nav--desktop" v-if="navYears.length > 0">
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
        :title="`${year.year}年${month.label} (${month.count}张)`"
        :disabled="navigating"
      >
        {{ month.label }}
      </button>
    </template>
  </nav>

  <!-- 移动端：浮动按钮 + Modal -->
  <template v-if="navYears.length > 0">
    <button
      class="timeline-nav__fab"
      :class="{ 'timeline-nav__fab--active': showModal }"
      @click="showModal = !showModal"
      title="时间线"
    >
      <Calendar :size="20" />
    </button>

    <Modal
      v-model="showModal"
      size="sm"
      title="时间线"
    >
      <div class="timeline-modal">
        <div
          v-for="year in navYears"
          :key="year.year"
          class="timeline-modal__year-group"
        >
          <div class="timeline-modal__year">{{ year.year }}年</div>
          <div class="timeline-modal__months">
            <button
              v-for="month in year.months"
              :key="month.key"
              class="timeline-modal__month"
              :class="{
                'timeline-modal__month--active': month.key === currentGroup,
                'timeline-modal__month--disabled': navigating,
              }"
              @click="handleMonthClick(month.key)"
              :disabled="navigating"
            >
              <span class="timeline-modal__month-label">{{ month.label }}</span>
              <span class="timeline-modal__month-count">{{ month.count }}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  </template>
</template>

<style scoped>
/* ============================================
   桌面端导航条
   ============================================ */
.timeline-nav--desktop {
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

.timeline-nav--desktop::-webkit-scrollbar {
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
  background: rgba(120, 120, 120, 0.15);
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

/* ============================================
   移动端浮动按钮
   ============================================ */
.timeline-nav__fab {
  display: none;
  position: fixed;
  right: var(--spacing-4);
  bottom: var(--spacing-4);
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  z-index: var(--z-index-sticky);
  transition: var(--transition-fast-out);
}

.timeline-nav__fab:hover {
  transform: scale(1.05);
}

.timeline-nav__fab:active {
  transform: scale(0.95);
}

.timeline-nav__fab--active {
  background: var(--color-primary-dark);
}

/* ============================================
   移动端 Modal 内容
   ============================================ */
.timeline-modal {
  max-height: 60vh;
  overflow-y: auto;
}

.timeline-modal__year-group {
  margin-bottom: var(--spacing-4);
}

.timeline-modal__year-group:last-child {
  margin-bottom: 0;
}

.timeline-modal__year {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-3);
  padding-left: var(--spacing-1);
}

.timeline-modal__months {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-2);
}

.timeline-modal__month {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3) var(--spacing-2);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast-out);
  font-family: var(--font-sans);
}

.timeline-modal__month:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
}

.timeline-modal__month--active {
  background: var(--color-primary-50);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.dark .timeline-modal__month--active {
  background: rgba(120, 120, 120, 0.15);
  border-color: var(--color-primary);
}

.timeline-modal__month--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.timeline-modal__month-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.timeline-modal__month--active .timeline-modal__month-label {
  color: var(--color-primary);
  font-weight: var(--font-semibold);
}

.timeline-modal__month-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-1);
}

.timeline-modal__month--active .timeline-modal__month-count {
  color: var(--color-primary);
}

/* ============================================
   响应式切换
   ============================================ */
@media (max-width: 768px) {
  .timeline-nav--desktop {
    display: none;
  }

  .timeline-nav__fab {
    display: flex;
  }
}
</style>
