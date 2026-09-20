import { defineStore } from "pinia";
import { ref } from "vue";
import { visual } from "memory-seek-api";
import type { Collection } from "memory-seek-api";

/**
 * 收藏夹状态管理
 */
export const useCollectionStore = defineStore("collection", () => {
  // 状态
  const collections = ref<Collection[]>([]);
  const loading = ref(false);

  /**
   * 获取收藏夹列表
   */
  async function fetchCollections(): Promise<Collection[]> {
    loading.value = true;
    try {
      const response = await visual.collection.getCollectionList();
      collections.value = response.data;
      return collections.value;
    } catch (error) {
      console.error("获取收藏夹列表失败:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 添加影像到收藏夹
   */
  async function addVisualsToCollection(
    collectionId: string,
    visualIds: string[],
  ): Promise<void> {
    await visual.collection.addVisualsToCollection(collectionId, visualIds);
    // 更新本地缓存的影像数量
    const collection = collections.value.find((c) => c.id === collectionId);
    if (collection) {
      collection.visualCount += visualIds.length;
    }
  }

  /**
   * 从收藏夹移除影像
   */
  async function removeVisualFromCollection(
    collectionId: string,
    visualId: string,
  ): Promise<void> {
    await visual.collection.removeVisualFromCollection(collectionId, visualId);
    // 更新本地缓存的影像数量
    const collection = collections.value.find((c) => c.id === collectionId);
    if (collection && collection.visualCount > 0) {
      collection.visualCount -= 1;
    }
  }

  /**
   * 创建收藏夹
   */
  async function createCollection(
    name: string,
    description?: string,
  ): Promise<Collection> {
    const response = await visual.collection.createCollection({
      name,
      description,
    });
    const newCollection = response.data;
    collections.value.push(newCollection);
    return newCollection;
  }

  /**
   * 删除收藏夹
   */
  async function deleteCollection(collectionId: string): Promise<void> {
    await visual.collection.deleteCollection(collectionId);
    collections.value = collections.value.filter((c) => c.id !== collectionId);
  }

  /**
   * 更新收藏夹信息
   */
  async function updateCollection(
    collectionId: string,
    param: { name?: string; description?: string },
  ): Promise<void> {
    await visual.collection.updateCollection(collectionId, param);
    const collection = collections.value.find((c) => c.id === collectionId);
    if (collection) {
      if (param.name !== undefined) collection.name = param.name;
      if (param.description !== undefined)
        collection.description = param.description ?? null;
    }
  }

  /**
   * 清空状态
   */
  function clear() {
    collections.value = [];
  }

  return {
    collections,
    loading,
    fetchCollections,
    addVisualsToCollection,
    removeVisualFromCollection,
    createCollection,
    deleteCollection,
    updateCollection,
    clear,
  };
});