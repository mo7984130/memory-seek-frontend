import { defineStore } from 'pinia'
import { ref } from 'vue'
import { user as userApi } from 'memory-seek-api'
import type { UserInfoResult } from 'memory-seek-api'
import { useAuthStore } from './auth'

const MAX_CACHE_SIZE = 200

/**
 * 用户信息缓存
 *
 * LRU 策略：超过上限时淘汰最早写入的条目
 */
export const useUserStore = defineStore('user', () => {
  const cache = ref(new Map<string, UserInfoResult>())
  const loadingIds = new Set<string>()

  /**
   * 初始化：将当前用户信息塞入缓存
   */
  function initSelf() {
    const auth = useAuthStore()
    if (!auth.user) return
    const self: UserInfoResult = {
      userId: auth.user.id,
      nickname: auth.user.nickname,
      avatarToken: auth.user.avatarToken ?? null,
    }
    cache.value.set(self.userId, self)
  }

  /**
   * 批量获取用户信息（带缓存）
   */
  async function fetchUsers(userIds: string[]): Promise<void> {
    const uncached = userIds.filter((id) => !cache.value.has(id) && !loadingIds.has(id))
    if (uncached.length === 0) return

    uncached.forEach((id) => loadingIds.add(id))
    try {
      const res = await userApi.getUserInfoBatch(uncached)
      for (const info of res.data) {
        if (info) {
          set(info.userId, info)
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    } finally {
      uncached.forEach((id) => loadingIds.delete(id))
    }
  }

  /**
   * 写入单条，超限淘汰最早的
   */
  function set(userId: string, info: UserInfoResult) {
    // 已存在则先删除再插入，保持最新在末尾
    if (cache.value.has(userId)) {
      cache.value.delete(userId)
    }
    // 淘汰最早的条目
    while (cache.value.size >= MAX_CACHE_SIZE) {
      const oldest = cache.value.keys().next().value
      if (oldest !== undefined) cache.value.delete(oldest)
    }
    cache.value.set(userId, info)
  }

  /**
   * 获取昵称
   */
  function getNickname(userId: string): string {
    return cache.value.get(userId)?.nickname ?? '未知'
  }

  /**
   * 获取头像 token
   */
  function getAvatarToken(userId: string): string | null {
    return cache.value.get(userId)?.avatarToken ?? null
  }

  /**
   * 清空缓存
   */
  function clear() {
    cache.value.clear()
  }

  return {
    cache,
    initSelf,
    fetchUsers,
    set,
    getNickname,
    getAvatarToken,
    clear,
  }
})
