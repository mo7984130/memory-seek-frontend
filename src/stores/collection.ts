import { defineStore } from 'pinia'
import { ref } from 'vue'
import { photo } from 'memory-seek-api'
import type { CollectionResult } from 'memory-seek-api'

/**
 * 收藏夹状态管理
 */
export const useCollectionStore = defineStore('collection', () => {
  // 状态
  const collections = ref<CollectionResult[]>([])
  const loading = ref(false)

  /**
   * 获取收藏夹列表
   */
  async function fetchCollections(): Promise<CollectionResult[]> {
    loading.value = true
    try {
      const response = await photo.collection.getCollectionList()
      collections.value = response.data
      return collections.value
    } catch (error) {
      console.error('获取收藏夹列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
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
   * 清空状态
   */
  function clear() {
    collections.value = []
  }

  return {
    collections,
    loading,
    fetchCollections,
    addPhotosToCollection,
    removePhotoFromCollection,
    createCollection,
    deleteCollection,
    updateCollection,
    clear,
  }
})
