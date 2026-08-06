<script setup lang="ts">
import { ref } from 'vue'
import AppTopBar from './AppTopBar.vue'
import AppDrawer from './AppDrawer.vue'
import { KEEP_ALIVE_COMPONENT_NAMES } from '@/router'

const drawerVisible = ref(false)

function openDrawer() {
  drawerVisible.value = true
}
</script>

<template>
  <div class="app-layout">
    <AppTopBar @menu-click="openDrawer" />
    <main class="app-layout__content">
      <!-- 缓存列表页：返回时保留浏览状态（数据 + 滚动位置），滚动由页面自行恢复 -->
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="KEEP_ALIVE_COMPONENT_NAMES">
          <component :is="Component" />
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
