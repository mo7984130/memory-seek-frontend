<script setup lang="ts">
import { ref } from 'vue'
import AppTopBar from './AppTopBar.vue'
import AppDrawer from './AppDrawer.vue'

const drawerVisible = ref(false)

function openDrawer() {
  drawerVisible.value = true
}
</script>

<template>
  <div class="app-layout">
    <AppTopBar @menu-click="openDrawer" />
    <main class="app-layout__content">
      <RouterView />
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
