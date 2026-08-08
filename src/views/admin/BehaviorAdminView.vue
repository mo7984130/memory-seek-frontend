<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import dayjs from "dayjs";
import { useIntersectionObserver } from "@vueuse/core";
import { photo } from "memory-seek-api";
import { ArrowLeft } from "@/components/base/Icon/icons";
import IconButton from "@/components/actions/IconButton/IconButton.vue";
import Button from "@/components/actions/Button/Button.vue";
import Spinner from "@/components/base/Spinner/Spinner.vue";
import Select from "@/components/form/Select/Select.vue";
import Input from "@/components/form/Input/Input.vue";
import Card from "@/components/data/Card/Card.vue";
import BackToTop from "@/components/actions/BackToTop/BackToTop.vue";
import VirtualWaterfall from "@/components/photo/VirtualWaterfall.vue";
import { useGoBack } from "@/composables/useGoBack";
import { useUserStore } from "@/stores/user";

defineOptions({ name: "BehaviorAdminView" });

// Behavior 相关类型未从 memory-seek-api 导出，本地定义与后端一致
type BehaviorTargetType =
  | "photo"
  | "face"
  | "person"
  | "comment"
  | "collection";
type UserBehaviorAction =
  | "view"
  | "upload"
  | "delete_photos"
  | "like"
  | "unlike"
  | "comment_publish"
  | "comment_delete"
  | "comment_like"
  | "comment_unlike"
  | "collect"
  | "uncollect"
  | "face_change_belonging"
  | "face_unassign"
  | "face_delete"
  | "face_compute"
  | "person_rename"
  | "person_merge"
  | "person_delete"
  | "person_full_scan"
  | "person_secondary_cluster";
type BehaviorGranularity = "day" | "week" | "month";

interface AuditItem {
  id: string;
  userId: string;
  action: UserBehaviorAction;
  targetType: BehaviorTargetType | null;
  targetId: number | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface StatsItem {
  bucket: string;
  count: number;
}

interface TopItem {
  targetId: number;
  count: number;
}

const { goBack } = useGoBack("/profile");
const userStore = useUserStore();

// ---------------- 常量选项 ----------------
const ACTION_OPTIONS: { label: string; value: UserBehaviorAction }[] = [
  { label: "浏览照片", value: "view" },
  { label: "上传照片", value: "upload" },
  { label: "批量删除照片", value: "delete_photos" },
  { label: "点赞照片", value: "like" },
  { label: "取消点赞", value: "unlike" },
  { label: "发布评论", value: "comment_publish" },
  { label: "删除评论", value: "comment_delete" },
  { label: "点赞评论", value: "comment_like" },
  { label: "取消点赞评论", value: "comment_unlike" },
  { label: "收藏照片", value: "collect" },
  { label: "取消收藏", value: "uncollect" },
  { label: "修改人脸归属", value: "face_change_belonging" },
  { label: "取消人脸归属", value: "face_unassign" },
  { label: "删除人脸", value: "face_delete" },
  { label: "人脸计算任务", value: "face_compute" },
  { label: "重命名人物", value: "person_rename" },
  { label: "合并人物", value: "person_merge" },
  { label: "删除人物", value: "person_delete" },
  { label: "人物全量扫描", value: "person_full_scan" },
  { label: "人物二次聚类", value: "person_secondary_cluster" },
];

const TARGET_TYPE_OPTIONS: { label: string; value: BehaviorTargetType }[] = [
  { label: "照片", value: "photo" },
  { label: "人脸", value: "face" },
  { label: "人物", value: "person" },
  { label: "评论", value: "comment" },
  { label: "收藏夹", value: "collection" },
];

const GRANULARITY_OPTIONS: { label: string; value: BehaviorGranularity }[] = [
  { label: "按日", value: "day" },
  { label: "按周", value: "week" },
  { label: "按月", value: "month" },
];

const ACTION_LABEL = Object.fromEntries(
  ACTION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<UserBehaviorAction, string>;

const TARGET_TYPE_LABEL = Object.fromEntries(
  TARGET_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<BehaviorTargetType, string>;

// ---------------- Tab ----------------
type TabKey = "audit" | "stats" | "top";
const activeTab = ref<TabKey>("audit");

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: "audit", label: "审计流水" },
  { key: "stats", label: "行为量统计" },
  { key: "top", label: "热门排行" },
];

// ---------------- 审计流水 ----------------
const AUDIT_PAGE_SIZE = 20;
const auditFilters = reactive<{
  action: UserBehaviorAction | null;
  targetType: BehaviorTargetType | null;
  targetId: string;
  userId: string;
}>({
  action: null,
  targetType: null,
  targetId: "",
  userId: "",
});

const auditRecords = ref<AuditItem[]>([]);
const auditCursor = ref<string | null>(null);
const auditHasMore = ref(false);
const auditLoading = ref(false);
const auditError = ref("");

// 触底自动加载（哨兵元素进入视口时加载下一页）
const auditSentinelRef = ref<HTMLElement | null>(null);
useIntersectionObserver(auditSentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false;
  if (isIntersecting && !auditLoading.value && auditHasMore.value) {
    loadAudit(false);
  }
});

// ---------------- 审计瀑布流布局 ----------------
const auditContainerRef = ref<HTMLElement | null>(null);
const auditColumnCount = ref(3);
const auditContainerWidth = ref(0);

function handleAuditResize() {
  if (!auditContainerRef.value) return;
  const style = getComputedStyle(auditContainerRef.value);
  const paddingLeft = parseInt(style.paddingLeft) || 0;
  const paddingRight = parseInt(style.paddingRight) || 0;
  auditContainerWidth.value =
    auditContainerRef.value.clientWidth - paddingLeft - paddingRight;

  if (auditContainerWidth.value < 640) {
    auditColumnCount.value = 1;
  } else if (auditContainerWidth.value < 1024) {
    auditColumnCount.value = 2;
  } else {
    auditColumnCount.value = 3;
  }
}

/** 审计卡片高度：无详情时略矮，有详情时更高（瀑布流错落效果） */
function auditCardHeight(item: unknown): number {
  const audit = item as AuditItem;
  return audit.detail ? 148 : 116;
}

/** 审计流水按天分组（供 VirtualWaterfall 分组模式渲染） */
const auditGroups = computed(() => {
  const map = new Map<string, AuditItem[]>();
  for (const record of auditRecords.value) {
    const key = record.createdAt.substring(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(record);
  }
  return Array.from(map.entries()).map(([key, records]) => ({
    key,
    label: dayjs(key).format("M月D日"),
    items: records.map((r) => ({ ...r, width: 1, height: 1 })),
  }));
});

/** 瀑布流插槽传入的 item 含原始审计字段，转为 AuditItem 使用 */
function asAuditItem(item: unknown): AuditItem {
  return item as AuditItem;
}

/** 审计详情序列化文本（供卡片显示与 title 提示） */
function detailText(item: unknown): string {
  return formatDetail(asAuditItem(item).detail as Record<string, unknown>);
}

function prefetchUsers() {
  const ids = Array.from(
    new Set(auditRecords.value.map((r) => r.userId).filter(Boolean)),
  );
  if (ids.length > 0) userStore.fetchUsers(ids);
}

async function loadAudit(reset = true) {
  if (auditLoading.value) return;
  auditLoading.value = true;
  auditError.value = "";
  try {
    const res = await photo.behavior.getBehaviorAudit({
      action: auditFilters.action,
      targetType: auditFilters.targetType,
      targetId: auditFilters.targetId ? Number(auditFilters.targetId) : null,
      userId: auditFilters.userId.trim() || null,
      cursor: reset ? null : auditCursor.value,
      size: AUDIT_PAGE_SIZE,
    });
    const page = res.data;
    auditRecords.value = reset
      ? page.records
      : [...auditRecords.value, ...page.records];
    auditCursor.value = page.nextCursor;
    auditHasMore.value = page.hasMore;
    prefetchUsers();
  } catch (error) {
    console.error("[BehaviorAdminView] 加载审计流水失败:", error);
    auditError.value = "加载失败，请确认管理员权限后重试";
  } finally {
    auditLoading.value = false;
  }
}

function resetAuditFilters() {
  auditFilters.action = null;
  auditFilters.targetType = null;
  auditFilters.targetId = "";
  auditFilters.userId = "";
  loadAudit(true);
}

function onAuditActionChange(value: string | number | undefined) {
  auditFilters.action = (value as UserBehaviorAction | undefined) ?? null;
  loadAudit(true);
}

function onAuditTargetTypeChange(value: string | number | undefined) {
  auditFilters.targetType = (value as BehaviorTargetType | undefined) ?? null;
  loadAudit(true);
}

function getUserLabel(userId: string): string {
  const nickname = userStore.getNickname(userId);
  return nickname === "未知" ? userId : `${nickname} (${userId})`;
}

function formatTime(dateStr: string): string {
  return dayjs(dateStr).format("YYYY/MM/DD HH:mm:ss");
}

function formatDetail(detail: Record<string, unknown>): string {
  return JSON.stringify(detail);
}

// ---------------- 行为量统计 ----------------
const statsFilters = reactive<{
  action: UserBehaviorAction | null;
  targetType: BehaviorTargetType | null;
  granularity: BehaviorGranularity;
}>({
  action: null,
  targetType: null,
  granularity: "day",
});

const statsItems = ref<StatsItem[]>([]);
const statsLoading = ref(false);
const statsError = ref("");
const statsLoaded = ref(false);

async function loadStats() {
  statsLoading.value = true;
  statsError.value = "";
  try {
    const res = await photo.behavior.getBehaviorStats({
      action: statsFilters.action,
      targetType: statsFilters.targetType,
      start: null,
      end: null,
      granularity: statsFilters.granularity,
    });
    statsItems.value = res.data;
  } catch (error) {
    console.error("[BehaviorAdminView] 加载行为量统计失败:", error);
    statsError.value = "加载失败，请确认管理员权限后重试";
  } finally {
    statsLoading.value = false;
  }
}

function onStatsActionChange(value: string | number | undefined) {
  statsFilters.action = (value as UserBehaviorAction | undefined) ?? null;
  loadStats();
}

function onStatsTargetTypeChange(value: string | number | undefined) {
  statsFilters.targetType = (value as BehaviorTargetType | undefined) ?? null;
  loadStats();
}

function onGranularityChange(value: string | number | undefined) {
  statsFilters.granularity =
    (value as BehaviorGranularity | undefined) ?? "day";
  loadStats();
}

function formatBucket(
  bucket: string,
  granularity: BehaviorGranularity,
): string {
  if (granularity === "month") {
    return dayjs(bucket).format("YYYY年M月");
  }
  return dayjs(bucket).format("M月D日");
}

const statsMax = computed(() =>
  Math.max(1, ...statsItems.value.map((i) => i.count)),
);

// ---------------- 热门排行 ----------------
const topFilters = reactive<{
  action: UserBehaviorAction;
  targetType: BehaviorTargetType;
  limit: string;
}>({
  action: "view",
  targetType: "photo",
  limit: "10",
});

const topItems = ref<TopItem[]>([]);
const topLoading = ref(false);
const topError = ref("");
const topLoaded = ref(false);

async function loadTop() {
  topLoading.value = true;
  topError.value = "";
  try {
    const limit = Math.max(1, Math.min(50, Number(topFilters.limit) || 10));
    const res = await photo.behavior.getBehaviorTop({
      action: topFilters.action,
      targetType: topFilters.targetType,
      limit,
    });
    topItems.value = res.data;
  } catch (error) {
    console.error("[BehaviorAdminView] 加载热门排行失败:", error);
    topError.value = "加载失败，请确认管理员权限后重试";
  } finally {
    topLoading.value = false;
  }
}

function onTopActionChange(value: string | number | undefined) {
  topFilters.action = (value as UserBehaviorAction | undefined) ?? "view";
  loadTop();
}

function onTopTargetTypeChange(value: string | number | undefined) {
  topFilters.targetType = (value as BehaviorTargetType | undefined) ?? "photo";
  loadTop();
}

function resetTopFilters() {
  topFilters.action = "view";
  topFilters.targetType = "photo";
  topFilters.limit = "10";
  loadTop();
}

// 切换 Tab 时懒加载统计/排行数据
watch(activeTab, (tab) => {
  if (tab === "stats" && !statsLoaded.value) {
    statsLoaded.value = true;
    loadStats();
  }
  if (tab === "top" && !topLoaded.value) {
    topLoaded.value = true;
    loadTop();
  }
});

onMounted(() => {
  handleAuditResize();
  window.addEventListener("resize", handleAuditResize);
  loadAudit(true);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleAuditResize);
});
</script>

<template>
  <div class="behavior-admin">
    <!-- 页头 -->
    <div class="behavior-admin__header">
      <IconButton class="behavior-admin__back" @click="goBack">
        <ArrowLeft :size="20" />
      </IconButton>
      <div class="behavior-admin__title-group">
        <h1 class="behavior-admin__title">行为审计</h1>
        <p class="behavior-admin__desc">
          查询用户行为记录、行为量统计与热门目标排行（仅管理员可见）
        </p>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="behavior-admin__tabs">
      <button
        v-for="tab in TAB_ITEMS"
        :key="tab.key"
        type="button"
        class="behavior-admin__tab"
        :class="{ 'behavior-admin__tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 审计流水 -->
    <div v-if="activeTab === 'audit'" class="behavior-admin__panel">
      <Card shadow="sm" padding="md">
        <div class="audit-filters">
          <Select
            class="audit-filters__select"
            :model-value="auditFilters.action ?? undefined"
            :options="ACTION_OPTIONS"
            clearable
            placeholder="全部动作"
            @update:model-value="onAuditActionChange"
          />
          <Select
            class="audit-filters__select"
            :model-value="auditFilters.targetType ?? undefined"
            :options="TARGET_TYPE_OPTIONS"
            clearable
            placeholder="全部目标类型"
            @update:model-value="onAuditTargetTypeChange"
          />
          <Input
            v-model="auditFilters.targetId"
            type="number"
            placeholder="目标 ID"
            class="audit-filters__input"
            @keydown.enter="loadAudit(true)"
          />
          <Input
            v-model="auditFilters.userId"
            placeholder="用户 ID"
            class="audit-filters__input"
            @keydown.enter="loadAudit(true)"
          />
          <Button variant="outline" size="md" @click="loadAudit(true)">
            查询
          </Button>
          <Button variant="ghost" size="md" @click="resetAuditFilters">
            重置
          </Button>
        </div>
      </Card>

      <div ref="auditContainerRef" class="audit-list">
        <Spinner
          v-if="auditLoading && auditRecords.length === 0"
          size="lg"
          class="audit-list__loading"
        />

        <p v-else-if="auditError" class="audit-list__empty">{{ auditError }}</p>

        <p v-else-if="auditRecords.length === 0" class="audit-list__empty">
          暂无审计记录
        </p>

        <template v-else>
          <VirtualWaterfall
            :groups="auditGroups"
            :column-count="auditColumnCount"
            :container-width="auditContainerWidth"
            :gap="16"
            :item-height="auditCardHeight"
            :group-header-height="40"
          >
            <template #default="{ item }">
              <div class="audit-card">
                <div class="audit-card__head">
                  <span class="audit-card__action">{{
                    ACTION_LABEL[asAuditItem(item).action]
                  }}</span>
                  <span class="audit-card__target">
                    {{
                      asAuditItem(item).targetType
                        ? TARGET_TYPE_LABEL[
                            asAuditItem(item).targetType as BehaviorTargetType
                          ]
                        : "—"
                    }}
                    <template v-if="asAuditItem(item).targetId != null">
                      #{{ asAuditItem(item).targetId }}</template
                    >
                  </span>
                </div>
                <div class="audit-card__meta">
                  <span class="audit-card__user">{{
                    getUserLabel(asAuditItem(item).userId)
                  }}</span>
                  <span v-if="asAuditItem(item).ip" class="audit-card__ip"
                    >IP {{ asAuditItem(item).ip }}</span
                  >
                  <span class="audit-card__id"
                    >#{{ asAuditItem(item).id }}</span
                  >
                </div>
                <div class="audit-card__time">
                  {{ formatTime(asAuditItem(item).createdAt) }}
                </div>
                <div
                  v-if="asAuditItem(item).detail"
                  class="audit-card__detail"
                  :title="detailText(item)"
                >
                  {{ detailText(item) }}
                </div>
              </div>
            </template>
          </VirtualWaterfall>

          <div ref="auditSentinelRef" class="audit-list__more">
            <Spinner v-if="auditLoading" size="sm" />
            <span v-else-if="!auditHasMore" class="audit-list__end"
              >已加载全部记录</span
            >
          </div>
        </template>
      </div>
    </div>

    <!-- 行为量统计 -->
    <div v-else-if="activeTab === 'stats'" class="behavior-admin__panel">
      <Card shadow="sm" padding="md">
        <div class="stats-filters">
          <Select
            class="stats-filters__select"
            :model-value="statsFilters.action ?? undefined"
            :options="ACTION_OPTIONS"
            clearable
            placeholder="全部动作"
            @update:model-value="onStatsActionChange"
          />
          <Select
            class="stats-filters__select"
            :model-value="statsFilters.targetType ?? undefined"
            :options="TARGET_TYPE_OPTIONS"
            clearable
            placeholder="全部目标类型"
            @update:model-value="onStatsTargetTypeChange"
          />
          <Select
            class="stats-filters__select stats-filters__select--sm"
            :model-value="statsFilters.granularity"
            :options="GRANULARITY_OPTIONS"
            @update:model-value="onGranularityChange"
          />
        </div>
      </Card>

      <div class="stats-list">
        <Spinner v-if="statsLoading" size="lg" class="stats-list__loading" />

        <p v-else-if="statsError" class="stats-list__empty">{{ statsError }}</p>

        <p v-else-if="statsItems.length === 0" class="stats-list__empty">
          暂无统计数据
        </p>

        <Card v-else shadow="sm" padding="md">
          <div v-for="item in statsItems" :key="item.bucket" class="stats-item">
            <span class="stats-item__label">
              {{ formatBucket(item.bucket, statsFilters.granularity) }}
            </span>
            <div class="stats-item__track">
              <div
                class="stats-item__bar"
                :style="{ width: `${(item.count / statsMax) * 100}%` }"
              />
            </div>
            <span class="stats-item__count">{{ item.count }}</span>
          </div>
        </Card>
      </div>
    </div>

    <!-- 热门排行 -->
    <div v-else class="behavior-admin__panel">
      <Card shadow="sm" padding="md">
        <div class="top-filters">
          <Select
            class="top-filters__select"
            :model-value="topFilters.action"
            :options="ACTION_OPTIONS"
            placeholder="动作（必选）"
            @update:model-value="onTopActionChange"
          />
          <Select
            class="top-filters__select"
            :model-value="topFilters.targetType"
            :options="TARGET_TYPE_OPTIONS"
            placeholder="目标类型（必选）"
            @update:model-value="onTopTargetTypeChange"
          />
          <Input
            v-model="topFilters.limit"
            type="number"
            placeholder="条数"
            class="top-filters__input"
            @keydown.enter="loadTop"
          />
          <Button variant="outline" size="md" @click="loadTop"> 查询 </Button>
          <Button variant="ghost" size="md" @click="resetTopFilters">
            重置
          </Button>
        </div>
      </Card>

      <div class="top-list">
        <Spinner v-if="topLoading" size="lg" class="top-list__loading" />

        <p v-else-if="topError" class="top-list__empty">{{ topError }}</p>

        <p v-else-if="topItems.length === 0" class="top-list__empty">
          暂无排行数据
        </p>

        <Card v-else shadow="sm" padding="md">
          <div
            v-for="(item, index) in topItems"
            :key="item.targetId"
            class="top-item"
          >
            <span
              class="top-item__rank"
              :class="`top-item__rank--${index + 1}`"
            >
              {{ index + 1 }}
            </span>
            <span class="top-item__target">
              {{ TARGET_TYPE_LABEL[topFilters.targetType] }} #{{
                item.targetId
              }}
            </span>
            <span class="top-item__count">{{ item.count }} 次</span>
          </div>
        </Card>
      </div>
    </div>

    <!-- 回到顶部 -->
    <BackToTop />
  </div>
</template>

<style scoped>
.behavior-admin {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

/* 页头 */
.behavior-admin__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-6);
}

.behavior-admin__title-group {
  min-width: 0;
}

.behavior-admin__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.behavior-admin__desc {
  margin: var(--spacing-1) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Tab 导航 */
.behavior-admin__tabs {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-1);
  background: var(--color-bg-hover);
  border-radius: var(--radius-lg);
  width: fit-content;
  max-width: 100%;
}

.behavior-admin__tab {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-size: var(--text-sm);
  font-family: inherit;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-fast-out);
  white-space: nowrap;
}

.behavior-admin__tab--active {
  background: var(--color-bg-card);
  color: var(--color-primary);
  font-weight: var(--font-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* 通用筛选栏 */
.behavior-admin__panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

/* 筛选卡片内 Select 下拉为绝对定位展开，需允许溢出显示 */
.behavior-admin :deep(.card) {
  overflow: visible;
}

.audit-filters,
.stats-filters,
.top-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-3);
}

.audit-filters__select,
.stats-filters__select,
.top-filters__select {
  flex: 0 1 180px;
  min-width: 140px;
}

.stats-filters__select--sm {
  flex: 0 1 120px;
}

.audit-filters__input,
.top-filters__input {
  flex: 0 1 140px;
  min-width: 120px;
}

/* 审计流水列表 */
.audit-list,
.stats-list,
.top-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.audit-list__loading,
.stats-list__loading,
.top-list__loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-16) 0;
}

.audit-list__empty,
.stats-list__empty,
.top-list__empty {
  margin: 0;
  padding: var(--spacing-16) 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.audit-card {
  height: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  overflow: hidden;
}

.audit-card__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.audit-card__action {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-primary);
}

.audit-card__target {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.audit-card__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.audit-card__id {
  margin-left: auto;
  font-family: var(--font-mono);
}

.audit-card__time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.audit-card__detail {
  margin-top: auto;
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-list__more {
  display: flex;
  justify-content: center;
  padding: var(--spacing-4) 0 var(--spacing-8);
}

.audit-list__end {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

/* 行为量统计条形图 */
.stats-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-1) 0;
}

.stats-item__label {
  flex-shrink: 0;
  width: 96px;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-align: right;
}

.stats-item__track {
  flex: 1;
  height: 10px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.stats-item__bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-fast) var(--ease-out);
}

.stats-item__count {
  flex-shrink: 0;
  width: 40px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  text-align: right;
}

/* 热门排行 */
.top-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
}

.top-item__rank {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.top-item__rank--1 {
  background: rgba(255, 193, 7, 0.15);
  color: #b8860b;
}

.top-item__rank--2 {
  background: rgba(160, 160, 160, 0.18);
  color: #7a7a7a;
}

.top-item__rank--3 {
  background: rgba(205, 127, 50, 0.15);
  color: #a0522d;
}

.top-item__target {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-item__count {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

@media (max-width: 768px) {
  .behavior-admin {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .audit-filters__select,
  .audit-filters__input,
  .stats-filters__select,
  .top-filters__select,
  .top-filters__input {
    flex: 1 1 100%;
    min-width: 0;
  }

  .stats-item__label {
    width: 72px;
  }
}
</style>
