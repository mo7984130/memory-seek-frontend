<script setup lang="ts">
import { ref, onMounted, onActivated, nextTick, watch } from "vue";
import { useRouter } from "vue-router";
import { useDebounceFn, useIntersectionObserver } from "@vueuse/core";
import { photo } from "memory-seek-api";
import type { Person } from "memory-seek-api";
import { useListScrollRestore } from "@/composables/useListScrollRestore";
import { consumeListDirty } from "@/composables/useListDirty";
import { FaceIcon, SearchIcon } from "@/components/base/Icon/icons";
import Card from "@/components/data/Card/Card.vue";
import Input from "@/components/form/Input/Input.vue";
import Spinner from "@/components/base/Spinner/Spinner.vue";

// 组件名（KeepAlive include 匹配）
defineOptions({ name: "PersonsView" });

const router = useRouter();

// 返回时恢复滚动位置（KeepAlive 缓存页）
const { restoreScroll } = useListScrollRestore();

// 搜索关键词
const keyword = ref("");
// 搜索面板是否展开
const searchOpen = ref(false);

const searchInputRef = ref<InstanceType<typeof Input> | null>(null);

/**
 * 切换搜索面板；展开时自动聚焦输入框
 */
async function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) {
    await nextTick();
    searchInputRef.value?.focus();
  }
}

/**
 * 关闭搜索面板（关键词清空后重置列表）
 */
function closeSearch() {
  searchOpen.value = false;
  if (keyword.value) {
    keyword.value = "";
  }
}

// 人物列表（游标分页）
const persons = ref<Person[]>([]);
const cursor = ref<string | null>(null);
const hasMore = ref(true);
const loading = ref(false);

const sentinelRef = ref<HTMLElement | null>(null);

/**
 * 拉取一页人物；cursor 为空表示第一页
 * 有关键词时走搜索接口，否则走列表接口
 */
async function fetchPage() {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  try {
    const kw = keyword.value.trim();
    const res = kw
      ? await photo.person.searchPersons(kw, { cursor: cursor.value, size: 32 })
      : await photo.person.getPersons({ cursor: cursor.value, size: 32 });
    const page = res.data;
    persons.value.push(...page.records);
    cursor.value = page.nextCursor;
    hasMore.value = page.hasMore;
  } catch (error) {
    console.error("[PersonsView] 加载人物列表失败:", error);
  } finally {
    loading.value = false;
  }
}

/**
 * 重置列表并重新拉取（关键词变化时调用）
 */
async function reload() {
  persons.value = [];
  cursor.value = null;
  hasMore.value = true;
  await fetchPage();
}

// 关键词防抖搜索
const onKeywordChange = useDebounceFn(reload, 300);

watch(keyword, () => {
  onKeywordChange();
});

// 触底加载（组件卸载时自动停止观察）
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false;
  if (isIntersecting && !loading.value && hasMore.value) {
    fetchPage();
  }
});

/**
 * 进入人物详情
 */
function enterPerson(person: Person) {
  router.push({
    path: `/persons/${person.id}`,
    // faceCount 运行时为 number（.d.ts 声明为 bigint），显式转换以兼容 HistoryState 序列化
    state: { person: { ...person, faceCount: Number(person.faceCount) } },
  });
}

onMounted(() => {
  fetchPage();
});

// 从详情页返回：详情页改过人物（改名/删除/合并）时刷新列表，随后恢复浏览位置
onActivated(async () => {
  if (consumeListDirty("persons")) {
    // 记录离开时已加载的数量，刷新后补足到相同数量，保证高度足够恢复滚动位置
    const targetCount = persons.value.length;
    await reload();
    while (hasMore.value && persons.value.length < targetCount) {
      await fetchPage();
    }
  }
  await restoreScroll();
});
</script>

<template>
  <div class="persons-view">
    <!-- 标题栏 -->
    <div class="persons-view__header">
      <div class="persons-view__count" v-if="persons.length > 0">
        {{ keyword.trim() ? "找到" : "" }}{{ persons.length }} 位人物
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
          <div class="person-card__count">
            {{ Number(person.faceCount) }} 张照片
          </div>
        </div>
      </Card>
    </div>

    <!-- 空状态 -->
    <div v-else class="persons-view__empty">
      <FaceIcon :size="56" class="persons-view__empty-icon" />
      <template v-if="keyword.trim()">
        <div class="persons-view__empty-text">未找到相关人物</div>
        <div class="persons-view__empty-hint">
          换个关键词试试，支持姓名或首字母搜索
        </div>
      </template>
      <template v-else>
        <div class="persons-view__empty-text">暂无人物</div>
        <div class="persons-view__empty-hint">
          识别照片中出现的人脸后会显示在这里
        </div>
      </template>
    </div>

    <!-- 触底加载指示器 -->
    <div ref="sentinelRef" class="load-sentinel">
      <Spinner v-if="loading" />
      <span
        v-else-if="!hasMore && persons.length > 0"
        class="load-sentinel__text"
      >
        已经到底啦 ~
      </span>
    </div>

    <!-- 右上角悬浮搜索按钮 + 搜索面板 -->
    <div class="persons-view__search-fab">
      <Transition name="persons-search">
        <div v-if="searchOpen" class="persons-view__search-panel">
          <Input
            ref="searchInputRef"
            v-model="keyword"
            clearable
            size="md"
            placeholder="搜索人物姓名或首字母"
            @keydown.esc="closeSearch"
          >
            <template #prefix>
              <SearchIcon :size="16" class="persons-view__search-icon" />
            </template>
          </Input>
        </div>
      </Transition>
      <button
        type="button"
        class="persons-view__search-btn"
        :class="{ 'persons-view__search-btn--active': keyword.trim() }"
        :title="keyword.trim() ? `当前搜索：${keyword.trim()}` : '搜索人物'"
        @click="toggleSearch"
      >
        <SearchIcon :size="18" />
        <span class="persons-view__search-btn-text">
          {{ keyword.trim() ? `已搜索：${keyword.trim()}` : "搜索人物" }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.persons-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.persons-view__search-fab {
  position: fixed;
  top: calc(var(--app-topbar-height, 56px) + var(--spacing-4));
  right: var(--spacing-6);
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  gap: var(--spacing-3);
  z-index: var(--z-index-fixed);
}

.persons-view__search-panel {
  display: flex;
  align-items: center;
}

.persons-view__search-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
  transition:
    background var(--transition-fast) var(--ease-out),
    border-color var(--transition-fast) var(--ease-out),
    color var(--transition-fast) var(--ease-out),
    transform var(--transition-fast-out);
}

.persons-view__search-btn:hover {
  background: var(--color-bg-hover);
  transform: translateY(-1px);
}

.persons-view__search-btn:active {
  transform: scale(0.96);
}

.persons-view__search-btn--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.persons-view__search-btn-text {
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.persons-view__search-icon {
  color: var(--color-text-tertiary);
}

/* 搜索面板进入/离开动画 */
.persons-search-enter-active,
.persons-search-leave-active {
  transition:
    opacity var(--transition-fast) var(--ease-out),
    transform var(--transition-fast) var(--ease-out);
}

.persons-search-enter-from,
.persons-search-leave-to {
  opacity: 0;
  transform: translateX(8px);
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
  content: "";
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

  .persons-view__search-fab {
    right: var(--spacing-4);
  }

  .persons-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
