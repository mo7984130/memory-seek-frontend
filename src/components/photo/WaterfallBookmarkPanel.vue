<!-- 瀑布流"加载位置书签"面板 - 可复用组件
     书签与加载参数（anchorTime）关联：保存当前浏览位置，点击书签从该位置重新加载照片流
     使用方式：页面提供 currentAnchor（当前顶部照片的锚点信息）并监听 jump 事件执行跳转 -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { Bookmark, History, Plus, X } from "@/components/base/Icon/icons";
import {
  useWaterfallBookmarks,
  type WaterfallBookmark,
} from "@/composables/useWaterfallBookmarks";
import Modal from "@/components/feedback/Modal/Modal.vue";
import Input from "@/components/form/Input/Input.vue";
import dayjs from "dayjs";

/**
 * 当前浏览位置的锚点信息（由页面根据视口顶部照片计算）
 */
interface BookmarkAnchor {
  /** 位置标签，如 "2026年6月" */
  label: string;
  /** 月份 key，如 "2026-06" */
  monthKey: string;
  /** 加载锚点时间（ISO 字符串） */
  anchorTime: string;
  /** 更详细的时间提示，如 "2026年6月15日 14:30" */
  detail?: string;
}

const props = withDefaults(
  defineProps<{
    /** 与页面瀑布流一致的存储键名（photos / likes / ...） */
    storageKey: string;
    /** 当前浏览位置的锚点信息；暂无浏览位置时为 null */
    currentAnchor?: BookmarkAnchor | null;
  }>(),
  { currentAnchor: null },
);

const emit = defineEmits<{
  (e: "jump", bookmark: WaterfallBookmark): void;
}>();

const bookmarks = useWaterfallBookmarks(props.storageKey);

// ---- UI 状态 ----
const panelVisible = ref(false);
const addModalVisible = ref(false);
const bookmarkName = ref("");

const count = computed(() => bookmarks.bookmarks.value.length);

function handleAdd() {
  if (!props.currentAnchor) return;
  // 默认名称 = 当前位置标签，用户可修改
  bookmarkName.value = props.currentAnchor.label;
  addModalVisible.value = true;
}

function handleConfirmAdd() {
  if (!props.currentAnchor) return;
  const label = bookmarkName.value.trim() || props.currentAnchor.label;
  bookmarks.addBookmark({
    label,
    anchorTime: props.currentAnchor.anchorTime,
    monthKey: props.currentAnchor.monthKey,
  });
  addModalVisible.value = false;
}

function handleNameKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    handleConfirmAdd();
  }
}

function handleJump(bookmark: WaterfallBookmark) {
  panelVisible.value = false;
  emit("jump", bookmark);
}

function handleRemove(bookmark: WaterfallBookmark) {
  if (bookmark.auto) {
    // 自动书签：删除后继续浏览到更远位置会重新生成
    bookmarks.removeAutoBookmark();
  } else {
    bookmarks.removeBookmark(bookmark.id);
  }
}

function formatTime(timestamp: number): string {
  return dayjs(timestamp).format("YYYY/MM/DD");
}

/** 月份 key → "2026年6月" */
function formatMonth(monthKey: string): string {
  const parts = monthKey.split("-");
  return `${parts[0]}年${parseInt(parts[1]!)}月`;
}
</script>

<template>
  <div class="waterfall-bookmark-panel">
    <!-- 弹出面板 -->
    <Transition name="bookmark-pop">
      <div v-if="panelVisible" class="waterfall-bookmark-panel__pop">
        <div class="waterfall-bookmark-panel__header">
          <span class="waterfall-bookmark-panel__title">位置书签</span>
        </div>

        <!-- 在此处添加书签 -->
        <button
          class="waterfall-bookmark-panel__add"
          type="button"
          :disabled="!currentAnchor"
          @click="handleAdd"
        >
          <Plus :size="16" />
          <span>{{
            currentAnchor
              ? `在此处添加书签（${currentAnchor.detail ?? currentAnchor.label}）`
              : "暂无浏览位置"
          }}</span>
        </button>

        <!-- 书签列表 -->
        <div class="waterfall-bookmark-panel__list">
          <div
            v-for="bookmark in bookmarks.bookmarks.value"
            :key="bookmark.id"
            class="waterfall-bookmark-panel__item"
            :class="{ 'waterfall-bookmark-panel__item--auto': bookmark.auto }"
          >
            <button
              class="waterfall-bookmark-panel__item-main"
              type="button"
              :title="`从 ${bookmark.label} 开始加载`"
              @click="handleJump(bookmark)"
            >
              <History
                v-if="bookmark.auto"
                :size="14"
                class="waterfall-bookmark-panel__item-icon"
              />
              <Bookmark
                v-else
                :size="14"
                fill="currentColor"
                class="waterfall-bookmark-panel__item-icon"
              />
              <span class="waterfall-bookmark-panel__item-label">{{
                bookmark.label
              }}</span>
              <span class="waterfall-bookmark-panel__item-time">
                {{
                  bookmark.auto
                    ? formatMonth(bookmark.monthKey)
                    : formatTime(bookmark.createdAt)
                }}
              </span>
            </button>
            <button
              class="waterfall-bookmark-panel__item-remove"
              type="button"
              :title="
                bookmark.auto
                  ? '删除自动书签（继续浏览后重新生成）'
                  : '删除书签'
              "
              @click="handleRemove(bookmark)"
            >
              <X :size="14" />
            </button>
          </div>

          <div v-if="count === 0" class="waterfall-bookmark-panel__empty">
            暂无书签<br />
            浏览到想记住的位置时，点击上方按钮添加
          </div>
        </div>
      </div>
    </Transition>

    <!-- 浮动按钮 -->
    <button
      class="waterfall-bookmark-panel__fab"
      :class="{ 'waterfall-bookmark-panel__fab--active': panelVisible }"
      type="button"
      :title="`位置书签（${count}）`"
      @click="panelVisible = !panelVisible"
    >
      <Bookmark :size="20" :fill="panelVisible ? 'currentColor' : 'none'" />
    </button>

    <!-- 添加书签命名弹窗 -->
    <Modal v-model="addModalVisible" size="sm" title="添加位置书签">
      <div class="waterfall-bookmark-panel__modal-body">
        <p class="waterfall-bookmark-panel__modal-tip">
          将从
          <strong>{{
            currentAnchor ? (currentAnchor.detail ?? currentAnchor.label) : ""
          }}</strong>
          开始加载照片
        </p>
        <Input
          v-model="bookmarkName"
          placeholder="书签名称"
          @keydown="handleNameKeydown"
        />
      </div>
      <template #footer>
        <div class="waterfall-bookmark-panel__modal-footer">
          <button
            class="waterfall-bookmark-panel__modal-cancel"
            type="button"
            @click="addModalVisible = false"
          >
            取消
          </button>
          <button
            class="waterfall-bookmark-panel__modal-confirm"
            type="button"
            @click="handleConfirmAdd"
          >
            保存
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.waterfall-bookmark-panel {
  position: fixed;
  /* 右上角：位于"回到上次浏览位置"按钮（top 72px，高约 38px）下方，避免重叠 */
  top: calc(56px + var(--spacing-4) + 46px);
  right: var(--spacing-4);
  bottom: auto;
  z-index: var(--z-index-sticky);
}

/* ============ 浮动按钮 ============ */
.waterfall-bookmark-panel__fab {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  transition: var(--transition-fast-out);
}

.waterfall-bookmark-panel__fab:hover {
  transform: scale(1.05);
}

.waterfall-bookmark-panel__fab:active {
  transform: scale(0.95);
}

.waterfall-bookmark-panel__fab--active {
  background: var(--color-primary-dark);
}

/* ============ 弹出面板 ============ */
.waterfall-bookmark-panel__pop {
  position: absolute;
  top: 0;
  right: calc(44px + var(--spacing-2));
  width: 280px;
  max-width: calc(100vw - var(--spacing-8));
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.waterfall-bookmark-panel__header {
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border-light);
}

.waterfall-bookmark-panel__title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.waterfall-bookmark-panel__add {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-primary-50);
  color: var(--color-primary);
  border: none;
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: left;
  transition: var(--transition-fast-out);
}

.dark .waterfall-bookmark-panel__add {
  background: rgba(120, 120, 120, 0.1);
}

.waterfall-bookmark-panel__add:not(:disabled):hover {
  background: var(--color-bg-hover);
}

.waterfall-bookmark-panel__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============ 书签列表 ============ */
.waterfall-bookmark-panel__list {
  max-height: 40vh;
  overflow-y: auto;
  padding: var(--spacing-2);
}

.waterfall-bookmark-panel__item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  transition: var(--transition-fast-out);
}

.waterfall-bookmark-panel__item:hover {
  background: var(--color-bg-hover);
}

.waterfall-bookmark-panel__item-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 0;
  padding: var(--spacing-2) var(--spacing-2) var(--spacing-2) var(--spacing-3);
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.waterfall-bookmark-panel__item-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

/* 自动书签（最远浏览位置）：金色图标区分 */
.waterfall-bookmark-panel__item--auto .waterfall-bookmark-panel__item-icon {
  color: var(--color-warning, #f59e0b);
}

.waterfall-bookmark-panel__item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.waterfall-bookmark-panel__item-time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.waterfall-bookmark-panel__item-remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: var(--spacing-1);
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast-out);
}

.waterfall-bookmark-panel__item-remove:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-like, #ef4444);
}

.waterfall-bookmark-panel__empty {
  padding: var(--spacing-6) var(--spacing-3);
  text-align: center;
  font-size: var(--text-sm);
  line-height: 1.8;
  color: var(--color-text-tertiary);
}

/* ============ 命名弹窗 ============ */
.waterfall-bookmark-panel__modal-tip {
  margin: 0 0 var(--spacing-3);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.waterfall-bookmark-panel__modal-tip strong {
  color: var(--color-primary);
}

.waterfall-bookmark-panel__modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-2);
}

.waterfall-bookmark-panel__modal-cancel,
.waterfall-bookmark-panel__modal-confirm {
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  font-family: inherit;
  transition: var(--transition-fast-out);
}

.waterfall-bookmark-panel__modal-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.waterfall-bookmark-panel__modal-cancel:hover {
  background: var(--color-bg-hover);
}

.waterfall-bookmark-panel__modal-confirm {
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  color: #fff;
}

.waterfall-bookmark-panel__modal-confirm:hover {
  background: var(--color-primary-dark);
}

/* ============ 弹出动画 ============ */
.bookmark-pop-enter-active,
.bookmark-pop-leave-active {
  transition:
    opacity var(--transition-fast) var(--ease-out),
    transform var(--transition-fast) var(--ease-out);
}

.bookmark-pop-enter-from,
.bookmark-pop-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

@media (max-width: 768px) {
  .waterfall-bookmark-panel {
    right: var(--spacing-3);
  }
}
</style>
