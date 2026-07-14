<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Sun, Moon } from '@/components/base/Icon/icons'
import { photo } from 'memory-seek-api'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import IconButton from '@/components/actions/IconButton/IconButton.vue'

const emit = defineEmits<{
  'menu-click': []
}>()

const route = useRoute()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const pageTitle = computed(() => {
  const title = route.meta.title
  return title ? String(title) : '寻忆'
})

const avatarUrl = computed(() => {
  const token = authStore.user?.avatarToken
  return token ? photo.getImgUrl(token) : null
})

const avatarText = computed(() => {
  const name = authStore.nickname || 'U'
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <header class="app-topbar">
    <div class="app-topbar__left">
      <IconButton class="app-topbar__menu" @click="emit('menu-click')">
        <Menu :size="22" />
      </IconButton>
      <h1 class="app-topbar__title">{{ pageTitle }}</h1>
    </div>
    <div class="app-topbar__right">
      <IconButton class="app-topbar__theme-btn" @click="themeStore.toggleTheme()">
        <Moon v-if="!themeStore.isDark" :size="20" />
        <Sun v-else :size="20" />
      </IconButton>
      <div class="app-topbar__avatar" @click="$router.push('/profile')">
        <img v-if="avatarUrl" :src="avatarUrl" class="app-topbar__avatar-img" alt="" />
        <span v-else>{{ avatarText }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  z-index: var(--z-index-sticky);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-3);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
}

.app-topbar__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.app-topbar__menu {
  color: var(--color-text-primary);
}

.app-topbar__title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin: 0;
}

.app-topbar__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.app-topbar__theme-btn {
  color: var(--color-text-secondary);
}

.app-topbar__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-fast-out);
  overflow: hidden;
}

.app-topbar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (hover: hover) and (pointer: fine) {
  .app-topbar__avatar:hover {
    opacity: 0.85;
    transform: scale(1.05);
  }
}
</style>
