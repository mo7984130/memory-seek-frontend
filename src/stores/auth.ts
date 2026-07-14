import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, user as userApi, AuthStorage } from 'memory-seek-api'
import type { UserInfo } from 'memory-seek-api'
import router from '@/router'
import { useUserStore } from './user'

/**
 * 认证状态管理
 * - Storage 中只保存登录凭证（tokens + userId）
 * - 用户信息通过 /me 接口获取，仅保存在内存中
 */
export const useAuthStore = defineStore('auth', () => {
  // 用户信息（仅内存）
  const userInfo = ref<UserInfo | null>(null)
  const loading = ref(false)

  // 计算属性
  const user = computed(() => userInfo.value)
  const userId = computed(() => userInfo.value?.id ?? AuthStorage.getUserId())
  const isAuthenticated = computed(() => AuthStorage.getAccessToken() != null)
  const nickname = computed(() => userInfo.value?.nickname ?? userInfo.value?.username ?? '')

  /**
   * 从 /me 接口获取用户信息（每次访问网站时调用）
   */
  async function hydrate() {
    if (!isAuthenticated.value) return
    loading.value = true
    try {
      const res = await userApi.getMe()
      userInfo.value = res.data
      // 将当前用户信息注入用户缓存
      useUserStore().initSelf()
    } catch {
      // token 失效时 API 拦截器会自动处理
    } finally {
      loading.value = false
    }
  }

  /**
   * 登录
   */
  async function login(account: string, password: string): Promise<boolean> {
    try {
      const response = await auth.login({ account, password })
      if (response.code === 200 && response.data) {
        const result = response.data
        // Storage 只存凭证：userId + tokens
        AuthStorage.setLoginResult({
          user: { id: result.user.id } as UserInfo,
          accessToken: result.accessToken,
          accessTokenExpireAt: result.accessTokenExpireAt,
          refreshToken: result.refreshToken,
          refreshTokenExpireAt: result.refreshTokenExpireAt,
        })
        // 内存中保存完整用户信息
        userInfo.value = result.user
        // 将当前用户信息注入用户缓存
        useUserStore().initSelf()
        return true
      }
      return false
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  /**
   * 登出
   */
  function logout() {
    userInfo.value = null
    AuthStorage.clearLoginResult()
    router.push('/login')
  }

  return {
    user,
    userId,
    isAuthenticated,
    nickname,
    loading,
    hydrate,
    login,
    logout,
  }
})
