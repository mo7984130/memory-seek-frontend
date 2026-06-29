import { createRouter, createWebHistory } from 'vue-router'
import { AuthStorage } from 'memory-seek-api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录', requiresGuest: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/photos',
        },
        {
          path: 'photos',
          name: 'photos',
          component: () => import('@/views/PhotoWaterfallView.vue'),
          meta: { title: '照片墙' },
        },
        {
          path: 'likes',
          name: 'likes',
          component: () => import('@/views/LikesView.vue'),
          meta: { title: '我喜欢' },
        },
        {
          path: 'collections',
          name: 'collections',
          component: () => import('@/views/CollectionsView.vue'),
          meta: { title: '收藏夹' },
        },
        {
          path: 'collections/:id',
          name: 'collection-detail',
          component: () => import('@/views/CollectionDetailView.vue'),
          meta: { title: '收藏夹' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: '个人中心' },
        },
      ],
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('@/views/test.vue'),
      meta: { title: '测试', requiresAuth: false },
    },
  ],
})

/**
 * 路由守卫
 * - 未登录时访问需要认证的页面，重定向到登录页
 * - 已登录时访问需要游客的页面（如登录页），重定向到照片墙
 */
router.beforeEach((to) => {
  // 设置页面标题
  const title = to.meta.title ? String(to.meta.title) : ''
  document.title = title ? `${title} - 寻忆` : '寻忆'

  const isAuthenticated = AuthStorage.checkLogin()

  // 需要认证的页面（检查 matched 链路上是否有 requiresAuth）
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  if (requiresAuth && !isAuthenticated) {
    return '/login'
  }

  // 需要游客的页面（已登录时不能访问）
  if (to.meta.requiresGuest && isAuthenticated) {
    return '/photos'
  }
})

export default router
