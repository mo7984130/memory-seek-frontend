<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import AppTopBar from './AppTopBar.vue'
import AppDrawer from './AppDrawer.vue'
import { KEEP_ALIVE_COMPONENT_NAMES } from '@/router'

const drawerVisible = ref(false)

function openDrawer() {
  drawerVisible.value = true
}

const route = useRoute()

// 详情页参数变化时强制重挂载组件（否则同路由复用实例，切换人物/收藏夹时数据不刷新）
const detailRouteNames = ['person-detail', 'collection-detail']
const routeKey = computed(() =>
  detailRouteNames.includes(String(route.name)) ? route.fullPath : undefined,
)
</script>

<template>
  <div class="app-layout">
    <AppTopBar @menu-click="openDrawer" />
    <main class="app-layout__content">
      <!-- 缓存列表页：返回时保留浏览状态（数据 + 滚动位置），滚动由页面自行恢复 -->
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="KEEP_ALIVE_COMPONENT_NAMES">
          <component :is="Component" :key="routeKey" />
        </KeepAlive>
      </RouterView>
    </main>
    <AppDrawer v-model="drawerVisible" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.app-layout__content {
  flex: 1;
  padding-top: 56px;
}
</style>
