<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'
import { photo } from 'memory-seek-api'
import type { Person } from 'memory-seek-api'
import { FaceIcon } from '@/components/base/Icon/icons'
import Card from '@/components/data/Card/Card.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'

const router = useRouter()

// 人物列表（游标分页）
const persons = ref<Person[]>([])
const cursor = ref<string | null>(null)
const hasMore = ref(true)
const loading = ref(false)

const sentinelRef = ref<HTMLElement | null>(null)

/**
 * 拉取一页人物；cursor 为空表示第一页
 */
async function fetchPage() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const res = await photo.person.getPersons({ cursor: cursor.value, size: 32 })
    const page = res.data
    persons.value.push(...page.records)
    cursor.value = page.nextCursor
    hasMore.value = page.hasMore
  } catch (error) {
    console.error('[PersonsView] 加载人物列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 触底加载（组件卸载时自动停止观察）
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !loading.value && hasMore.value) {
    fetchPage()
  }
})

/**
 * 进入人物详情
 */
function enterPerson(person: Person) {
  router.push({
    path: `/persons/${person.id}`,
    // faceCount 运行时为 number（.d.ts 声明为 bigint），显式转换以兼容 HistoryState 序列化
    state: { person: { ...person, faceCount: Number(person.faceCount) } },
  })
}

onMounted(() => {
  fetchPage()
})
</script>

<template>
  <div class="persons-view">
    <!-- 标题栏 -->
    <div class="persons-view__header">
      <div class="persons-view__count" v-if="persons.length > 0">
        {{ persons.length }} 位人物
      </div>
    </div>

    <!-- 首屏加载状态 -->
    <div v-if="loading && persons.length === 0" class="persons-view__loading">
      <Spinner size="lg" />
    </div>

    <!-- 人物网格 -->
    <div v-else-if="persons.length > 0" class="persons-view__grid">
      <Card
        v-for="person in persons"
        :key="person.id"
        shadow="sm"
        padding="none"
        hoverable
        class="person-card"
        @click="enterPerson(person)"
      >
        <div class="person-card__cover">
          <img
            v-if="person.coverToken"
            :src="photo.getImgUrl(person.coverToken)"
            class="person-card__cover-img"
            alt=""
          />
          <FaceIcon v-else :size="40" class="person-card__cover-icon" />
        </div>
        <div class="person-card__info">
          <div class="person-card__name">{{ person.name }}</div>
          <div class="person-card__count">{{ Number(person.faceCount) }} 张照片</div>
        </div>
      </Card>
    </div>

    <!-- 空状态 -->
    <div v-else class="persons-view__empty">
      <FaceIcon :size="56" class="persons-view__empty-icon" />
      <div class="persons-view__empty-text">暂无人物</div>
      <div class="persons-view__empty-hint">识别照片中出现的人脸后会显示在这里</div>
    </div>

    <!-- 触底加载指示器 -->
    <div ref="sentinelRef" class="load-sentinel">
      <Spinner v-if="loading" />
      <span v-else-if="!hasMore && persons.length > 0" class="load-sentinel__text">
        已经到底啦 ~
      </span>
    </div>
  </div>
</template>

<style scoped>
.persons-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.persons-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: var(--spacing-5) 0;
}

.persons-view__count {
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.persons-view__loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-16) 0;
}

.persons-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-5);
  padding-left: var(--spacing-8);
}

.person-card__cover {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-bg-hover);
}

.person-card__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.person-card__cover-icon {
  color: var(--color-text-tertiary);
  opacity: 0.6;
}

.person-card__info {
  padding: var(--spacing-3);
}

.person-card__name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-card__count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-1);
}

.persons-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16) 0;
  color: var(--color-text-tertiary);
}

.persons-view__empty-icon {
  margin-bottom: var(--spacing-4);
  opacity: 0.5;
}

.persons-view__empty-text {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

.persons-view__empty-hint {
  font-size: var(--text-sm);
  margin-top: var(--spacing-2);
}

.load-sentinel {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-tertiary);
}

.load-sentinel__text {
  font-size: var(--text-sm);
  position: relative;
}

.load-sentinel__text::before,
.load-sentinel__text::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-border));
}

.load-sentinel__text::before {
  right: calc(100% + 12px);
}

.load-sentinel__text::after {
  left: calc(100% + 12px);
  background: linear-gradient(90deg, var(--color-border), transparent);
}

@media (max-width: 768px) {
  .persons-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .persons-view__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-3);
    padding-left: var(--spacing-2);
  }

  .persons-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
