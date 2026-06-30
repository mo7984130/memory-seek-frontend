import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import type { PhotoResult, MonthStat } from 'memory-seek-api'

/**
 * 照片墙状态管理
 * - 保持已加载的照片列表、滚动位置、时间线状态
 * - 组件销毁后数据仍在（内存中）
 * - 滚动位置备份到 sessionStorage，刷新后清除
 */
export const usePhotoStore = defineStore('photo', () => {
  // ======== 状态 ========

  // 照片列表数据
  const allPhotos = ref<PhotoResult[]>([])
  const cursor = ref<string | undefined>(undefined)
  const hasMore = ref(true)

  // 时间线状态
  const monthStats = ref<MonthStat[]>([])
  const currentGroup = ref('')

  // 滚动位置（内存中，同时备份到 sessionStorage）
  const scrollTop = ref(0)

  // ======== Actions ========

  /**
   * 追加照片列表
   */
  function appendPhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value.push(...photos)
    cursor.value = nextCursor
    hasMore.value = more
  }

  /**
   * 替换照片列表（用于时间线跳转）
   */
  function replacePhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value = photos
    cursor.value = nextCursor
    hasMore.value = more
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
  }

  /**
   * 保存滚动位置
   */
  function saveScrollPosition() {
    scrollTop.value = window.scrollY
    sessionStorage.setItem('photo-scroll', String(window.scrollY))
  }

  /**
   * 恢复滚动位置
   */
  function restoreScrollPosition() {
    const saved = sessionStorage.getItem('photo-scroll')
    if (saved) {
      nextTick(() => {
        window.scrollTo(0, parseInt(saved))
      })
    }
  }

  /**
   * 重置状态（用于用户主动刷新）
   */
  function resetState() {
    allPhotos.value = []
    cursor.value = undefined
    hasMore.value = true
    monthStats.value = []
    currentGroup.value = ''
    scrollTop.value = 0
    sessionStorage.removeItem('photo-scroll')
  }

  return {
    // 状态
    allPhotos,
    cursor,
    hasMore,
    monthStats,
    currentGroup,
    scrollTop,

    // Actions
    appendPhotos,
    replacePhotos,
    updatePhotoLike,
    removePhoto,
    saveScrollPosition,
    restoreScrollPosition,
    resetState,
  }
})
