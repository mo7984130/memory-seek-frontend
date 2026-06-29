<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import Toast from './components/feedback/Toast/Toast.vue'

const themeStore = useThemeStore()
const authStore = useAuthStore()

onMounted(() => {
  themeStore.initTheme()
  authStore.hydrate()
})
</script>

<template>
  <RouterView />
  <Toast />
</template>
