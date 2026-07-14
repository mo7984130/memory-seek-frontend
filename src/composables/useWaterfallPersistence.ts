import { ref, nextTick, type Ref } from 'vue'
import type { PhotoResult, MonthStat } from 'memory-seek-api'

/**
 * 瀑布流状态持久化 Composable
 *
 * 功能：
 * - 保持已加载的照片列表
 * - 保持滚动位置（sessionStorage）
 * - 保持时间线状态
 *
 * @param storageKey - 存储键名，用于区分不同页面的状态
 */

// 全局状态存储，按 storageKey 区分
const stateMap = new Map<string, {
  allPhotos: Ref<PhotoResult[]>
  cursor: Ref<string | undefined>
  hasMore: Ref<boolean>
  monthStats: Ref<MonthStat[]>
  currentGroup: Ref<string>
}>()

function getOrCreateState(storageKey: string) {
  if (!stateMap.has(storageKey)) {
    stateMap.set(storageKey, {
      allPhotos: ref<PhotoResult[]>([]),
      cursor: ref<string | undefined>(undefined),
      hasMore: ref(true),
      monthStats: ref<MonthStat[]>([]),
      currentGroup: ref(''),
    })
    console.log(`[WaterfallPersistence:${storageKey}] 创建新状态`)
  }
  return stateMap.get(storageKey)!
}

export function useWaterfallPersistence(storageKey: string) {
  const SCROLL_KEY = `waterfall-scroll-${storageKey}`

  // 获取或创建全局状态
  const state = getOrCreateState(storageKey)

  // ======== Actions ========

  /**
   * 追加照片列表
   */
  function appendPhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    state.allPhotos.value.push(...photos)
    state.cursor.value = nextCursor
    state.hasMore.value = more
    console.log(`[WaterfallPersistence:${storageKey}] 追加照片`, {
      added: photos.length,
      total: state.allPhotos.value.length,
      hasMore: more,
    })
  }

  /**
   * 替换照片列表（用于时间线跳转）
   */
  function replacePhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    state.allPhotos.value = photos
    state.cursor.value = nextCursor
    state.hasMore.value = more
    console.log(`[WaterfallPersistence:${storageKey}] 替换照片`, {
      total: photos.length,
      hasMore: more,
    })
  }

  /**
   * 更新照片点赞状态
   */
  function updatePhotoLike(photoId: string, isLiked: boolean) {
    const target = state.allPhotos.value.find((p) => p.id === photoId)
    if (target) {
      target.isLiked = isLiked
    }
  }

  /**
   * 删除照片
   */
  function removePhoto(photoId: string) {
    state.allPhotos.value = state.allPhotos.value.filter((p) => p.id !== photoId)
    console.log(`[WaterfallPersistence:${storageKey}] 删除照片`, {
      photoId,
      remaining: state.allPhotos.value.length,
    })
  }

  /**
   * 保存滚动位置
   */
  function saveScrollPosition() {
    const scrollY = window.scrollY
    sessionStorage.setItem(SCROLL_KEY, String(scrollY))
    console.log(`[WaterfallPersistence:${storageKey}] 保存滚动位置`, { scrollY })
  }

  /**
   * 恢复滚动位置
   */
  function restoreScrollPosition() {
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) {
      const scrollY = parseInt(saved)
      nextTick(() => {
        window.scrollTo(0, scrollY)
        console.log(`[WaterfallPersistence:${storageKey}] 恢复滚动位置`, { scrollY })
      })
    }
  }

  /**
   * 检查是否有缓存状态
   */
  function hasCachedState(): boolean {
    return state.allPhotos.value.length > 0
  }

  /**
   * 重置状态
   */
  function resetState() {
    state.allPhotos.value = []
    state.cursor.value = undefined
    state.hasMore.value = true
    state.monthStats.value = []
    state.currentGroup.value = ''
    sessionStorage.removeItem(SCROLL_KEY)
    stateMap.delete(storageKey)
    console.log(`[WaterfallPersistence:${storageKey}] 重置状态`)
  }

  /**
   * 组件挂载时调用：恢复状态或返回 false 表示需要首次加载
   */
  function onMount(): boolean {
    const hasCached = state.allPhotos.value.length > 0
    console.log(`[WaterfallPersistence:${storageKey}] 组件挂载`, {
      hasCachedData: hasCached,
      photosCount: state.allPhotos.value.length,
    })

    if (hasCached) {
      // 有缓存数据，恢复滚动位置
      restoreScrollPosition()
      return true // 表示已恢复，跳过加载
    }

    // 没有缓存，需要首次加载
    return false
  }

  /**
   * 组件卸载时调用：保存滚动位置
   */
  function onUnmount() {
    saveScrollPosition()
    console.log(`[WaterfallPersistence:${storageKey}] 组件卸载`, {
      photosCount: state.allPhotos.value.length,
    })
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
    saveScrollPosition,
    restoreScrollPosition,
    hasCachedState,
    resetState,
    onMount,
    onUnmount,
  }
}
