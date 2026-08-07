import { createRouter, createWebHistory } from "vue-router";
import { AuthStorage } from "memory-seek-api";

/**
 * 被 KeepAlive 缓存的列表路由 name（滚动位置由页面自行恢复）
 */
export const KEEP_ALIVE_ROUTE_NAMES = [
  "photos",
  "persons",
  "unassigned-faces",
  "likes",
  "collections",
];

/**
 * 被 KeepAlive 缓存的列表组件名（AppLayout 中 include 匹配用）
 */
export const KEEP_ALIVE_COMPONENT_NAMES = [
  "PhotoWaterfallView",
  "PersonsView",
  "UnassignedFacesView",
  "LikesView",
  "CollectionsView",
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  /**
   * 滚动行为：
   * - 被 KeepAlive 缓存的列表页不在此处恢复滚动（返回 `false`），
   *   由页面在激活时用 useListScrollRestore 自行恢复浏览位置，
   *   避免这里强制回顶覆盖缓存页的滚动位置
   * - 后退/前进时恢复之前的滚动位置
   * - 普通导航回到顶部（同时禁用浏览器刷新后的原生滚动恢复，
   *   由"回到上次浏览位置"按钮统一接管）
   */
  scrollBehavior(to, _from, savedPosition) {
    if (
      typeof to.name === "string" &&
      KEEP_ALIVE_ROUTE_NAMES.includes(to.name)
    ) {
      return false;
    }
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/auth/LoginView.vue"),
      meta: { title: "登录", requiresGuest: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("@/views/auth/RegisterView.vue"),
      meta: { title: "注册", requiresGuest: true },
    },
    {
      path: "/",
      component: () => import("@/layouts/AppLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          redirect: "/photos",
        },
        {
          path: "photos",
          name: "photos",
          component: () => import("@/views/PhotoWaterfallView.vue"),
          meta: { title: "照片墙" },
        },
        {
          path: "persons",
          name: "persons",
          component: () => import("@/views/PersonsView.vue"),
          meta: { title: "人物" },
        },
        {
          path: "persons/:id",
          name: "person-detail",
          component: () => import("@/views/PersonDetailView.vue"),
          meta: { title: "人物" },
        },
        {
          path: "unassigned-faces",
          name: "unassigned-faces",
          component: () => import("@/views/UnassignedFacesView.vue"),
          meta: { title: "未分配人脸" },
        },
        {
          path: "likes",
          name: "likes",
          component: () => import("@/views/LikesView.vue"),
          meta: { title: "我喜欢" },
        },
        {
          path: "collections",
          name: "collections",
          component: () => import("@/views/CollectionsView.vue"),
          meta: { title: "收藏夹" },
        },
        {
          path: "collections/:id",
          name: "collection-detail",
          component: () => import("@/views/CollectionDetailView.vue"),
          meta: { title: "收藏夹" },
        },
        {
          path: "profile",
          name: "profile",
          component: () => import("@/views/ProfileView.vue"),
          meta: { title: "个人中心" },
        },
        {
          path: "admin/behaviors",
          name: "admin-behaviors",
          component: () => import("@/views/admin/BehaviorAdminView.vue"),
          meta: { title: "行为审计", requiresAdmin: true },
        },
      ],
    },
    {
      path: "/test",
      name: "test",
      component: () => import("@/views/test.vue"),
      meta: { title: "测试", requiresAuth: false },
    },
  ],
});

/**
 * 路由守卫
 * - 未登录时访问需要认证的页面，重定向到登录页
 * - 已登录时访问需要游客的页面（如登录页），重定向到照片墙
 */
router.beforeEach((to) => {
  // 设置页面标题
  const title = to.meta.title ? String(to.meta.title) : "";
  document.title = title ? `${title} - 寻忆` : "寻忆";

  const isAuthenticated = AuthStorage.checkLogin();

  // 需要认证的页面（检查 matched 链路上是否有 requiresAuth）
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
  if (requiresAuth && !isAuthenticated) {
    return "/login";
  }

  // 需要管理员的页面（后端管理员用户 ID 硬编码为 1）
  const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin);
  if (requiresAdmin && AuthStorage.getUserId() !== "1") {
    return "/photos";
  }

  // 需要游客的页面（已登录时不能访问）
  if (to.meta.requiresGuest && isAuthenticated) {
    return "/photos";
  }
});

export default router;
