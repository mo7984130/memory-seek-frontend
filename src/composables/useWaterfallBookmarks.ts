import { ref, type Ref } from "vue";

/**
 * 瀑布流"加载位置书签"
 *
 * 书签与加载参数（anchorTime）关联，不关联单张照片：
 * - 保存书签时记录当前浏览位置对应的加载锚点
 * - 点击书签后，页面从该书签的 anchorTime 重新加载照片流
 *
 * 另有一个自动维护的"最远浏览位置"书签：
 * - 始终跟随用户浏览到的"最远位置"（即创建时间最早的顶部照片）自动更新
 * - 可被用户删除（视为重置），继续浏览后从当前浏览位置重新生成
 *
 * - 持久化到 localStorage（按 storageKey 区分命名空间，互不干扰）
 * - 全局单例：跨路由切换保留内存态，避免重复读取
 */

export interface WaterfallBookmark {
  id: string;
  /** 书签名称（默认按月份生成，可编辑） */
  label: string;
  /** 加载锚点：getPhotos({ anchorTime }) */
  anchorTime: string;
  /** 对应月份 key（"2026-06"），用于恢复时间线高亮 */
  monthKey: string;
  /** 创建/更新时间戳（用于排序展示） */
  createdAt: number;
  /** 是否为自动维护的"最远浏览位置"书签 */
  auto?: boolean;
  /** 自动书签已记录的最早照片时间戳（毫秒），仅 auto 书签使用 */
  furthestTime?: number;
}

interface BookmarkState {
  /** 书签列表（最新在前） */
  bookmarks: Ref<WaterfallBookmark[]>;
  addBookmark: (param: {
    label: string;
    anchorTime: string;
    monthKey: string;
  }) => WaterfallBookmark;
  removeBookmark: (id: string) => void;
  /**
   * 更新"最远浏览位置"自动书签（仅更新已存在的；被删除重置后不在此生成，
   * 由加载照片后的 ensureAutoBookmark 重新生成）。
   * - 仅在浏览到创建时间更早的照片（更远位置）时更新
   * @param anchor 当前顶部照片对应的锚点信息
   */
  updateAutoBookmark: (anchor: {
    label: string;
    monthKey: string;
    anchorTime: string;
  }) => void;
  /**
   * 确保自动书签存在：不存在（被删除重置或首次）时以传入锚点为起点生成。
   * 供页面在加载照片成功后调用，避免删除后因滚动立即重新生成。
   */
  ensureAutoBookmark: (anchor: {
    label: string;
    monthKey: string;
    anchorTime: string;
  }) => void;
  /** 删除自动书签（重置，下次加载照片后重新生成） */
  removeAutoBookmark: () => void;
}

const STORAGE_PREFIX = "memory-seek:bookmarks";
/** 自动书签固定 id */
export const AUTO_BOOKMARK_ID = "auto-latest";
/** 自动书签默认名称 */
export const AUTO_BOOKMARK_LABEL = "最远浏览位置";
/** 自动书签更新节流（毫秒），避免频繁写 localStorage */
const AUTO_UPDATE_THROTTLE = 500;

// 全局状态存储，按 storageKey 区分
const stateMap = new Map<string, BookmarkState>();

function createState(storageKey: string): BookmarkState {
  const storageName = `${STORAGE_PREFIX}:${storageKey}`;
  const bookmarks = ref<WaterfallBookmark[]>(load());

  // 自动书签更新节流
  let lastAutoUpdateTime = 0;

  function load(): WaterfallBookmark[] {
    try {
      const raw = localStorage.getItem(storageName);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`[WaterfallBookmarks:${storageKey}] 读取书签失败:`, error);
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(storageName, JSON.stringify(bookmarks.value));
    } catch (error) {
      console.warn(`[WaterfallBookmarks:${storageKey}] 保存书签失败:`, error);
    }
  }

  function addBookmark(param: {
    label: string;
    anchorTime: string;
    monthKey: string;
  }): WaterfallBookmark {
    const bookmark: WaterfallBookmark = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ...param,
      createdAt: Date.now(),
    };
    // 最新的书签放在最前面
    bookmarks.value.unshift(bookmark);
    persist();
    console.log(`[WaterfallBookmarks:${storageKey}] 添加书签`, bookmark);
    return bookmark;
  }

  function removeBookmark(id: string) {
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id);
    persist();
    console.log(`[WaterfallBookmarks:${storageKey}] 删除书签`, { id });
  }

  function updateAutoBookmark(anchor: {
    label: string;
    monthKey: string;
    anchorTime: string;
  }) {
    const existing = bookmarks.value.find((b) => b.id === AUTO_BOOKMARK_ID);
    // 被删除重置后不在此生成，等待下次加载照片（ensureAutoBookmark）重新生成
    if (!existing) return;

    const now = Date.now();
    if (now - lastAutoUpdateTime < AUTO_UPDATE_THROTTLE) return;
    lastAutoUpdateTime = now;

    // 顶部照片创建时间（毫秒）；解析失败则不更新
    const nextTime = Date.parse(anchor.anchorTime);
    if (!Number.isFinite(nextTime)) return;

    // 只有浏览到创建时间更早的照片（更远位置）时才更新
    if (nextTime >= (existing.furthestTime ?? Number.POSITIVE_INFINITY)) return;
    existing.label = anchor.label;
    existing.anchorTime = anchor.anchorTime;
    existing.monthKey = anchor.monthKey;
    existing.furthestTime = nextTime;
    existing.createdAt = now;
    persist();
  }

  function ensureAutoBookmark(anchor: {
    label: string;
    monthKey: string;
    anchorTime: string;
  }) {
    const existing = bookmarks.value.find((b) => b.id === AUTO_BOOKMARK_ID);
    if (existing) return;

    const nextTime = Date.parse(anchor.anchorTime);
    if (!Number.isFinite(nextTime)) return;

    bookmarks.value.unshift({
      id: AUTO_BOOKMARK_ID,
      ...anchor,
      auto: true,
      furthestTime: nextTime,
      createdAt: Date.now(),
    });
    persist();
    console.log(`[WaterfallBookmarks:${storageKey}] 加载后生成自动书签`, {
      anchorTime: anchor.anchorTime,
    });
  }

  function removeAutoBookmark() {
    const index = bookmarks.value.findIndex((b) => b.id === AUTO_BOOKMARK_ID);
    if (index === -1) return;
    bookmarks.value.splice(index, 1);
    persist();
    console.log(
      `[WaterfallBookmarks:${storageKey}] 删除自动书签（重置，继续浏览后重新生成）`,
    );
  }

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateAutoBookmark,
    ensureAutoBookmark,
    removeAutoBookmark,
  };
}

export function useWaterfallBookmarks(storageKey: string): BookmarkState {
  if (!stateMap.has(storageKey)) {
    stateMap.set(storageKey, createState(storageKey));
  }
  return stateMap.get(storageKey)!;
}
