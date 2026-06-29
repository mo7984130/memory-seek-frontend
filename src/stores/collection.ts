import { defineStore } from 'pinia'
import { ref } from 'vue'
import { photo } from 'memory-seek-api'
import type { CollectionResult } from 'memory-seek-api'

/**
 * 收藏夹状态管理
 *
 * 缓存收藏夹列表，避免重复请求
 */
export const useCollectionStore = defineStore('collection', () => {
  // 状态
  const collections = ref<CollectionResult[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  /**
   * 获取收藏夹列表
   * @param force 是否强制刷新
   */
  async function fetchCollections(force = false): Promise<CollectionResult[]> {
    // 已加载且不强制刷新时，直接返回缓存
    if (loaded.value && !force) {
      return collections.value
    }

    // 正在加载中，等待完成
    if (loading.value) {
      await waitForLoad()
      return collections.value
    }

    loading.value = true
    try {
      const response = await photo.collection.getCollectionList()
      collections.value = response.data
      loaded.value = true
      return collections.value
    } catch (error) {
      console.error('获取收藏夹列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 等待加载完成
   */
  function waitForLoad(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!loading.value) {
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })
  }

  /**
   * 添加照片到收藏夹
   */
  async function addPhotosToCollection(collectionId: string, photoIds: string[]): Promise<void> {
    await photo.collection.addPhotosToCollection(collectionId, photoIds)
    // 更新本地缓存的照片数量
    const collection = collections.value.find((c) => c.id === collectionId)
    if (collection) {
      collection.photoCount += photoIds.length
    }
  }

  /**
   * 从收藏夹移除照片
   */
  async function removePhotoFromCollection(collectionId: string, photoId: string): Promise<void> {
    await photo.collection.removePhotoFromCollection(collectionId, photoId)
    // 更新本地缓存的照片数量
    const collection = collections.value.find((c) => c.id === collectionId)
    if (collection && collection.photoCount > 0) {
      collection.photoCount -= 1
    }
  }

  /**
   * 创建收藏夹
   */
  async function createCollection(name: string, description?: string): Promise<CollectionResult> {
    const response = await photo.collection.createCollection({ name, description })
    const newCollection = response.data
    collections.value.push(newCollection)
    return newCollection
  }

  /**
   * 删除收藏夹
   */
  async function deleteCollection(collectionId: string): Promise<void> {
    await photo.collection.deleteCollection(collectionId)
    collections.value = collections.value.filter((c) => c.id !== collectionId)
  }

  /**
   * 更新收藏夹信息
   */
  async function updateCollection(
    collectionId: string,
    param: { name?: string; description?: string },
  ): Promise<void> {
    await photo.collection.updateCollection(collectionId, param)
    const collection = collections.value.find((c) => c.id === collectionId)
    if (collection) {
      if (param.name !== undefined) collection.name = param.name
      if (param.description !== undefined) collection.description = param.description ?? null
    }
  }

  /**
   * 清空缓存
   */
  function clear() {
    collections.value = []
    loaded.value = false
  }

  return {
    collections,
    loading,
    loaded,
    fetchCollections,
    addPhotosToCollection,
    removePhotoFromCollection,
    createCollection,
    deleteCollection,
    updateCollection,
    clear,
  }
})
