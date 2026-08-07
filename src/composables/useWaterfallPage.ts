import { ref, computed, nextTick } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import type { Photo, MonthStat } from "memory-seek-api";
import { useWaterfallPersistence } from "./useWaterfallPersistence";
import {
  useWaterfallBookmarks,
  AUTO_BOOKMARK_LABEL,
} from "./useWaterfallBookmarks";
import type { WaterfallGroup } from "@/components/photo/VirtualWaterfall.vue";

/**
 * 瀑布流页面 Composable
 *
 * 收敛三个页面（照片墙 / 我喜欢 / 收藏夹详情）共用的逻辑：
 * - 响应式列数与容器宽度
 * - 按月分组
 * - 触底加载（游标分页）
 * - 浏览位置捕获（top-item-change → cursor）
 * - “回到上次浏览位置”按钮触发的恢复（会话内定位 / cursor 重新拉取）
 * - 时间线导航（照片墙，可选）
 *
 * @example
 * const page = useWaterfallPage({
 *   storageKey: 'photos',
 *   fetch: async ({ cursor, anchorTime }) =>
 *     (await photo.getPhotos({ cursor, size: 20, direction: 'next', anchorTime })).data,
 *   fetchTimeline: async () => (await photo.timeline.getMonthlyStats()).data,
 * })
 */

export interface WaterfallPageFetchResult {
  records: Photo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UseWaterfallPageOptions {
  /** 持久化存储键名（photos / likes / collection-<id>） */
  storageKey: string;
  /** 获取一页照片；cursor 为空表示从开头（或按 anchorTime） */
  fetch: (params: {
    cursor?: string;
    anchorTime?: string;
  }) => Promise<WaterfallPageFetchResult>;
  /** 照片墙：获取时间线月度统计 */
  fetchTimeline?: () => Promise<MonthStat[]>;
  /**
   * 是否维护"最远浏览位置"自动书签（默认 true）。
   * 关闭后不自动创建/更新自动书签（已有书签不受影响）。
   */
  enableAutoBookmark?: boolean;
}

export function useWaterfallPage(options: UseWaterfallPageOptions) {
  const waterfall = useWaterfallPersistence(options.storageKey);
  // 位置书签（含自动维护的"最远浏览位置"书签）
  const bookmarkStore = useWaterfallBookmarks(options.storageKey);
  // "最远浏览位置"自动书签是否开启
  const autoBookmarkEnabled = options.enableAutoBookmark !== false;

  // ======== 布局 ========
  const containerRef = ref<HTMLElement | null>(null);
  const sentinelRef = ref<HTMLElement | null>(null);
  const columnCount = ref(4);
  const containerWidth = ref(0);
  const loading = ref(false);
  const navigating = ref(false);

  // 请求版本号：时间线跳转时丢弃在途请求结果，防止旧数据混入新列表
  let fetchGeneration = 0;
  // 由 initialize 注入：返回 VirtualWaterfall 实例（用于会话内恢复定位）
  let getWaterfallRef:
    | (() => { scrollToItem?: (id: string | number) => void } | null)
    | undefined;

  function handleResize() {
    if (!containerRef.value) return;
    const style = getComputedStyle(containerRef.value);
    const paddingLeft = parseInt(style.paddingLeft) || 0;
    const paddingRight = parseInt(style.paddingRight) || 0;
    containerWidth.value =
      containerRef.value.clientWidth - paddingLeft - paddingRight;

    if (containerWidth.value < 640) {
      columnCount.value = 2;
    } else if (containerWidth.value < 1024) {
      columnCount.value = 3;
    } else if (containerWidth.value < 1440) {
      columnCount.value = 4;
    } else {
      columnCount.value = 5;
    }
  }

  // ======== 按月分组 ========
  const groups = computed<WaterfallGroup[]>(() => {
    if (!waterfall.allPhotos.value.length) return [];

    const map = new Map<string, Photo[]>();
    for (const photo of waterfall.allPhotos.value) {
      const key = photo.createdAt.substring(0, 7); // "2026-06"
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }

    return Array.from(map.entries()).map(([key, photos]) => ({
      key,
      label: `${key.split("-")[0]}年${parseInt(key.split("-")[1]!)}月`,
      items: photos,
    }));
  });

  // ======== 加载 ========
  /**
   * 请求一页照片：replace=true 时替换列表（恢复/时间线跳转），否则追加（触底加载）
   */
  async function requestPage(
    params: { cursor?: string; anchorTime?: string },
    replace: boolean,
  ): Promise<Photo[]> {
    if (loading.value) return [];
    if (!replace && !waterfall.hasMore.value) return [];

    const gen = fetchGeneration;
    loading.value = true;
    try {
      const { records, nextCursor, hasMore } = await options.fetch(params);
      // 已被时间线跳转作废
      if (gen !== fetchGeneration) return [];

      if (replace) {
        waterfall.replacePhotos(
          records,
          nextCursor ?? undefined,
          hasMore,
          params.anchorTime,
          params.cursor,
        );
      } else {
        waterfall.appendPhotos(records, nextCursor ?? undefined, hasMore);
      }
      // 加载照片成功后确保"最远浏览位置"自动书签存在（被删除重置后在此重新生成）
      if (autoBookmarkEnabled) ensureAutoBookmark();
      return records;
    } catch (error) {
      console.error(
        `[WaterfallPage:${options.storageKey}] 获取照片失败:`,
        error,
      );
      return [];
    } finally {
      loading.value = false;
    }
  }

  /** 追加一页（触底加载） */
  function fetchMore(params: { cursor?: string; anchorTime?: string } = {}) {
    return requestPage(params, false);
  }

  /** 拉取一页并替换列表（按钮恢复用），随后落到页首 */
  async function fetchReplace(params: {
    cursor?: string;
    anchorTime?: string;
  }) {
    const records = await requestPage(params, true);
    await nextTick();
    window.scrollTo({ top: 0, behavior: "auto" });
    return records;
  }

  // 触底加载
  useIntersectionObserver(sentinelRef, (entries) => {
    const isIntersecting = entries[0]?.isIntersecting || false;
    if (isIntersecting && !loading.value && waterfall.hasMore.value) {
      fetchMore({ cursor: waterfall.cursor.value });
    }
  });

  // ======== 浏览位置捕获 ========
  /** 当前视口顶部照片 ID（供页面生成位置书签锚点） */
  const topItemId = ref<string | number | null>(null);

  /**
   * 当前顶部照片的锚点信息；topItemId 尚未就绪时回退到列表第一张
   */
  function getTopAnchor(): {
    label: string;
    monthKey: string;
    anchorTime: string;
  } | null {
    const photo =
      topItemId.value != null
        ? waterfall.allPhotos.value.find((p) => p.id === topItemId.value)
        : waterfall.allPhotos.value[0];
    if (!photo?.createdAt) return null;
    return {
      label: AUTO_BOOKMARK_LABEL,
      monthKey: photo.createdAt.substring(0, 7),
      anchorTime: photo.createdAt,
    };
  }

  function handleTopItemChange(item: { id: string | number }) {
    topItemId.value = item.id;
    waterfall.capturePosition(item.id);
    // 滚动跟踪：自动书签已存在时更新到更远位置（不在此生成）
    if (!autoBookmarkEnabled) return;
    const anchor = getTopAnchor();
    if (anchor) bookmarkStore.updateAutoBookmark(anchor);
  }

  /**
   * 确保自动书签存在（加载照片成功后调用）：
   * 被删除重置后不会因滚动立即重新生成，而是等下次加载照片时生成
   */
  function ensureAutoBookmark() {
    const anchor = getTopAnchor();
    if (anchor) bookmarkStore.ensureAutoBookmark(anchor);
  }

  /**
   * 回到上次浏览位置（由按钮触发）：
   * 先判断当前已加载的列表是否包含保存的位置——
   * - 包含（SPA 返回，内存缓存完整）：直接滚动到保存页的页首，不重新请求
   * - 不包含（刷新后只加载了第 0 页）：按保存的 cursor / anchorTime 重新拉取并替换列表
   */
  async function restoreToLastPosition(): Promise<void> {
    const saved = waterfall.getSavedPosition();
    if (!saved) return;

    // 主动恢复后允许捕获位置
    waterfall.markUserActive();

    // cursor 位置：当前列表包含该 cursor 时才走会话内定位
    if (saved.cursor != null) {
      const pageStartId = waterfall.getPageStartPhotoId(saved.cursor);
      if (pageStartId) {
        await nextTick();
        getWaterfallRef?.()?.scrollToItem?.(pageStartId);
        return;
      }
    }

    // 时间线锚点位置：当前列表就是该时间线列表时，直接定位到列表页首
    if (
      saved.anchorTime &&
      waterfall.getCurrentAnchorTime() === saved.anchorTime
    ) {
      const firstId = waterfall.getPageStartPhotoId(null);
      if (firstId) {
        await nextTick();
        getWaterfallRef?.()?.scrollToItem?.(firstId);
        return;
      }
    }

    // 列表不包含保存的位置 → 按 cursor / anchorTime 重新拉取并替换
    if (saved.anchorTime) {
      await fetchReplace({ anchorTime: saved.anchorTime });
    } else if (saved.cursor) {
      await fetchReplace({ cursor: saved.cursor });
    }
  }

  // ======== 初始化：正常加载（是否回到上次位置由按钮决定） ========
  /**
   * @param getWaterfall 返回 VirtualWaterfall 组件实例（用于按钮恢复时的会话内定位）
   */
  async function initialize(
    getWaterfall?: () => {
      scrollToItem?: (id: string | number) => void;
    } | null,
  ) {
    getWaterfallRef = getWaterfall;
    handleResize();
    window.addEventListener("resize", handleResize);

    const restored = waterfall.onMount();

    if (restored) {
      // SPA 返回：内存缓存完整，无需加载；是否回到上次位置由按钮决定
      return;
    }

    // 刷新：正常从开头加载；是否回到上次位置由按钮决定
    await Promise.all([
      fetchMore({}),
      options.fetchTimeline
        ? options
            .fetchTimeline()
            .then((stats) => {
              waterfall.monthStats.value = stats;
            })
            .catch((error) => {
              console.error(
                `[WaterfallPage:${options.storageKey}] 获取时间线统计失败:`,
                error,
              );
            })
        : Promise.resolve(),
    ]);
  }

  // ======== 销毁 ========
  function dispose() {
    window.removeEventListener("resize", handleResize);
    waterfall.onUnmount();
  }

  // ======== 锚点加载（时间线导航 / 位置书签共用） ========
  /**
   * 从指定锚点时间重新加载照片流并落到页首。
   * @param anchorTime 加载锚点（ISO 字符串），如时间线导航的下月 1 号
   * @param monthKey 对应月份 key，同步时间线高亮
   */
  async function navigateToAnchor(anchorTime: string, monthKey?: string) {
    if (navigating.value) return;
    navigating.value = true;
    fetchGeneration++;
    // 主动跳转后允许捕获位置
    waterfall.markUserActive();

    try {
      const records = await requestPage({ anchorTime }, true);
      if (records.length) {
        if (monthKey) waterfall.currentGroup.value = monthKey;
        await nextTick();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      navigating.value = false;
    }
  }

  async function navigateToMonth(groupKey: string) {
    const parts = groupKey.split("-");
    const anchorTime = new Date(
      Date.UTC(parseInt(parts[0]!), parseInt(parts[1]!), 1),
    ).toISOString();
    await navigateToAnchor(anchorTime, groupKey);
  }

  return {
    waterfall,
    containerRef,
    sentinelRef,
    columnCount,
    containerWidth,
    loading,
    navigating,
    groups,
    fetchMore,
    topItemId,
    handleTopItemChange,
    restoreToLastPosition,
    initialize,
    dispose,
    navigateToMonth,
    navigateToAnchor,
  };
}
