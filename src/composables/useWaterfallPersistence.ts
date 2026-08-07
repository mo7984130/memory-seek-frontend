import { ref, type Ref } from "vue";
import type { Photo, MonthStat } from "memory-seek-api";

/**
 * 瀑布流状态持久化 Composable
 *
 * 功能：
 * - 保持已加载的照片列表（内存，SPA 路由往返不重新请求）
 * - 保存浏览位置：**cursor**（所在页的拉取游标）+ 可选 anchorTime（时间线锚点）
 *   - 由页面上的“回到上次浏览位置”按钮触发恢复：用 cursor 重新拉取该页，落到页首
 * - 保持时间线状态
 *
 * @param storageKey - 存储键名，用于区分不同页面的状态
 */

/** 保存的浏览位置结构 */
export interface WaterfallSavedPosition {
  /** 拉取“视口顶部所在页”所用的 cursor；null 表示从头加载 */
  cursor: string | null;
  /** 仅照片墙：位置落在时间线跳转列表第 0 页时记录锚点，恢复时重新按 anchorTime 拉取 */
  anchorTime?: string;
}

// 全局状态存储，按 storageKey 区分
const stateMap = new Map<
  string,
  {
    allPhotos: Ref<Photo[]>;
    cursor: Ref<string | undefined>;
    hasMore: Ref<boolean>;
    monthStats: Ref<MonthStat[]>;
    currentGroup: Ref<string>;
    /** photoId -> 拉取该照片所在页所用的 cursor（第 0 页为 undefined） */
    pageCursorMap: Map<string, string | undefined>;
    /** 时间线跳转列表的锚点时间（照片墙） */
    currentAnchorTime?: string;
  }
>();

function getOrCreateState(storageKey: string) {
  if (!stateMap.has(storageKey)) {
    stateMap.set(storageKey, {
      allPhotos: ref<Photo[]>([]),
      cursor: ref<string | undefined>(undefined),
      hasMore: ref(true),
      monthStats: ref<MonthStat[]>([]),
      currentGroup: ref(""),
      pageCursorMap: new Map(),
      currentAnchorTime: undefined,
    });
  }
  return stateMap.get(storageKey)!;
}

export function useWaterfallPersistence(storageKey: string) {
  // 旧版像素位置键（挂载时清理）
  const SCROLL_KEY = `waterfall-scroll-${storageKey}`;
  // 新版 cursor 位置键
  const POSITION_KEY = `waterfall-pos-${storageKey}`;

  // 获取或创建全局状态
  const state = getOrCreateState(storageKey);

  // 捕获节流状态（按 composable 实例隔离）
  let lastCaptureTime = 0;
  let lastTopPhotoId = "";
  // 用户主动操作（滚动/时间线跳转/恢复）后才允许捕获位置。
  // 初始加载也会触发 top-item-change，若不设门槛会把深位置覆盖成“第 0 页”
  let hasUserActive = false;

  /** 标记用户已主动操作，此后才允许捕获位置 */
  function markUserActive() {
    hasUserActive = true;
  }

  function handleScrollActive() {
    hasUserActive = true;
  }

  // ======== Actions ========

  /**
   * 追加照片列表
   */
  function appendPhotos(
    photos: Photo[],
    nextCursor?: string,
    more: boolean = true,
  ) {
    // 记录每张照片所在页的拉取游标（append 前的 cursor 即本次拉取所用）
    const fetchCursor = state.cursor.value;
    for (const photo of photos) {
      state.pageCursorMap.set(String(photo.id), fetchCursor);
    }

    state.allPhotos.value.push(...photos);
    state.cursor.value = nextCursor;
    state.hasMore.value = more;
  }

  /**
   * 替换照片列表（用于时间线跳转 / 按钮恢复）
   *
   * @param anchorTime 时间线锚点：新列表第 0 页由 anchorTime 拉取而非 cursor
   * @param page0Cursor 新列表第 0 页的拉取游标（cursor 恢复时传入；anchorTime 拉取时留空）
   */
  function replacePhotos(
    photos: Photo[],
    nextCursor?: string,
    more: boolean = true,
    anchorTime?: string,
    page0Cursor?: string,
  ) {
    state.pageCursorMap.clear();
    for (const photo of photos) {
      state.pageCursorMap.set(String(photo.id), page0Cursor);
    }
    state.currentAnchorTime = anchorTime;

    state.allPhotos.value = photos;
    state.cursor.value = nextCursor;
    state.hasMore.value = more;
  }

  /**
   * 更新照片点赞状态
   */
  function updatePhotoLike(photoId: string, isLiked: boolean) {
    const target = state.allPhotos.value.find((p) => p.id === photoId);
    if (target) {
      target.isLiked = isLiked;
    }
  }

  /**
   * 删除照片
   */
  function removePhoto(photoId: string) {
    state.allPhotos.value = state.allPhotos.value.filter(
      (p) => p.id !== photoId,
    );
    state.pageCursorMap.delete(String(photoId));
  }

  // ======== 浏览位置（cursor） ========

  /**
   * 把最近一次捕获的位置写入 sessionStorage
   */
  function writePosition() {
    if (!lastTopPhotoId || !state.pageCursorMap.has(lastTopPhotoId)) return;

    const cursor = state.pageCursorMap.get(lastTopPhotoId) ?? null;
    const position: WaterfallSavedPosition = { cursor };
    if (cursor == null && state.currentAnchorTime) {
      position.anchorTime = state.currentAnchorTime;
    }
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(position));
  }

  /**
   * 捕获当前位置：由 VirtualWaterfall 的 top-item-change 驱动（节流）
   */
  function capturePosition(topPhotoId: string | number) {
    if (!hasUserActive) return;

    lastTopPhotoId = String(topPhotoId);
    const now = Date.now();
    if (now - lastCaptureTime < 300) return;
    lastCaptureTime = now;
    writePosition();
  }

  /**
   * 读取保存的浏览位置
   */
  function getSavedPosition(): WaterfallSavedPosition | null {
    const raw = sessionStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    try {
      const pos = JSON.parse(raw);
      if (pos && typeof pos === "object" && "cursor" in pos) {
        return pos as WaterfallSavedPosition;
      }
    } catch {
      // JSON 损坏，忽略
    }
    return null;
  }

  /**
   * 找到保存 cursor 所在页的页首照片 id（用于会话内恢复定位）。
   * cursor 为 null 时返回列表第一张；当前列表不包含该 cursor 时返回 null
   */
  function getPageStartPhotoId(
    cursor: string | null | undefined,
  ): string | null {
    if (cursor == null) {
      const first = state.allPhotos.value[0];
      return first ? String(first.id) : null;
    }
    const photo = state.allPhotos.value.find(
      (p) => state.pageCursorMap.get(String(p.id)) === cursor,
    );
    return photo ? String(photo.id) : null;
  }

  /**
   * 当前列表的时间线锚点（无时间线跳转为 undefined）
   */
  function getCurrentAnchorTime(): string | undefined {
    return state.currentAnchorTime;
  }

  // ======== 生命周期 ========

  /**
   * 刷新前保存位置（onUnmount 在刷新时不一定会触发）
   */
  function handleBeforeUnload() {
    writePosition();
  }

  /**
   * 组件挂载时调用：返回是否有缓存状态（SPA 返回时为 true，跳过加载）
   */
  function onMount(): boolean {
    window.addEventListener("beforeunload", handleBeforeUnload);
    // 用户首次滚动后允许捕获位置
    window.addEventListener("scroll", handleScrollActive, { passive: true });
    // 清理旧版像素位置键
    sessionStorage.removeItem(SCROLL_KEY);
    return state.allPhotos.value.length > 0;
  }

  /**
   * 组件卸载时调用：保存最终位置
   */
  function onUnmount() {
    writePosition();
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("scroll", handleScrollActive);
  }

  /**
   * 重置状态
   */
  function resetState() {
    state.allPhotos.value = [];
    state.cursor.value = undefined;
    state.hasMore.value = true;
    state.monthStats.value = [];
    state.currentGroup.value = "";
    state.pageCursorMap.clear();
    state.currentAnchorTime = undefined;
    sessionStorage.removeItem(POSITION_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
    stateMap.delete(storageKey);
  }

  return {
    // 状态（从全局状态返回）
    allPhotos: state.allPhotos,
    cursor: state.cursor,
    hasMore: state.hasMore,
    monthStats: state.monthStats,
    currentGroup: state.currentGroup,

    // Actions
    appendPhotos,
    replacePhotos,
    updatePhotoLike,
    removePhoto,

    // 浏览位置（cursor）
    capturePosition,
    markUserActive,
    getSavedPosition,
    getPageStartPhotoId,
    getCurrentAnchorTime,

    // 生命周期
    onMount,
    onUnmount,
    resetState,
  };
}
