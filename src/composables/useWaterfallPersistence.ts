import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
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
export function useWaterfallPersistence(storageKey: string) {
  const SCROLL_KEY = `waterfall-scroll-${storageKey}`
  const STATE_KEY = `waterfall-state-${storageKey}`

  // ======== 状态 ========

  // 照片列表数据
  const allPhotos = ref<PhotoResult[]>([])
  const cursor = ref<string | undefined>(undefined)
  const hasMore = ref(true)

  // 时间线状态
  const monthStats = ref<MonthStat[]>([])
  const currentGroup = ref('')

  // 是否已恢复状态
  let stateRestored = false

  // ======== Actions ========

  /**
   * 追加照片列表
   */
  function appendPhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value.push(...photos)
    cursor.value = nextCursor
    hasMore.value = more
    console.log(`[WaterfallPersistence:${storageKey}] 追加照片`, {
      added: photos.length,
      total: allPhotos.value.length,
      hasMore: more,
    })
  }

  /**
   * 替换照片列表（用于时间线跳转）
   */
  function replacePhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value = photos
    cursor.value = nextCursor
    hasMore.value = more
    console.log(`[WaterfallPersistence:${storageKey}] 替换照片`, {
      total: photos.length,
      hasMore: more,
    })
  }

  /**
   * 更新照片点赞状态
   */
  function updatePhotoLike(photoId: string, isLiked: boolean) {
    const target = allPhotos.value.find((p) => p.id === photoId)
    if (target) {
      target.isLiked = isLiked
    }
  }

  /**
   * 删除照片
   */
  function removePhoto(photoId: string) {
    allPhotos.value = allPhotos.value.filter((p) => p.id !== photoId)
    console.log(`[WaterfallPersistence:${storageKey}] 删除照片`, {
      photoId,
      remaining: allPhotos.value.length,
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
    return allPhotos.value.length > 0
  }

  /**
   * 重置状态
   */
  function resetState() {
    allPhotos.value = []
    cursor.value = undefined
    hasMore.value = true
    monthStats.value = []
    currentGroup.value = ''
    sessionStorage.removeItem(SCROLL_KEY)
    sessionStorage.removeItem(STATE_KEY)
    console.log(`[WaterfallPersistence:${storageKey}] 重置状态`)
  }

  /**
   * 组件挂载时调用：恢复状态或返回 false 表示需要首次加载
   */
  function onMount(): boolean {
    console.log(`[WaterfallPersistence:${storageKey}] 组件挂载`, {
      hasCachedData: allPhotos.value.length > 0,
    })

    if (allPhotos.value.length > 0) {
      // 有缓存数据，恢复滚动位置
      restoreScrollPosition()
      stateRestored = true
      return true // 表示已恢复，跳过加载
    }

    // 没有缓存，需要首次加载
    stateRestored = false
    return false
  }

  /**
   * 组件卸载时调用：保存滚动位置
   */
  function onUnmount() {
    saveScrollPosition()
    console.log(`[WaterfallPersistence:${storageKey}] 组件卸载`, {
      photosCount: allPhotos.value.length,
    })
  }

  return {
    // 状态
    allPhotos,
    cursor,
    hasMore,
    monthStats,
    currentGroup,

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
