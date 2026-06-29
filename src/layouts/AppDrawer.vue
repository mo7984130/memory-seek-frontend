<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ImageIcon, LikeIcon, FavoriteIcon, User } from '@/components/base/Icon/icons'
import Drawer from '@/components/feedback/Drawer/Drawer.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const route = useRoute()
const router = useRouter()

interface NavItem {
  path: string
  label: string
  icon: typeof ImageIcon
}

const navItems: NavItem[] = [
  { path: '/photos', label: '照片墙', icon: ImageIcon },
  { path: '/likes', label: '我喜欢', icon: LikeIcon },
  { path: '/collections', label: '收藏夹', icon: FavoriteIcon },
  { path: '/profile', label: '个人中心', icon: User },
]

const activePath = computed(() => {
  // 匹配当前路由或其父级
  const path = route.path
  if (path.startsWith('/collections')) return '/collections'
  return path
})

function navigateTo(path: string) {
  router.push(path)
  emit('update:modelValue', false)
}
</script>

<template>
  <Drawer
    :model-value="modelValue"
    placement="left"
    size="md"
    :closable="true"
    :mask-closable="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="app-drawer">
      <!-- 品牌区域 -->
      <div class="app-drawer__brand">
        <div class="app-drawer__brand-title">寻忆</div>
        <div class="app-drawer__brand-subtitle">让时光驻留，让记忆重现</div>
      </div>

      <!-- 导航列表 -->
      <nav class="app-drawer__nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="app-drawer__nav-item"
          :class="{ 'app-drawer__nav-item--active': activePath === item.path }"
          type="button"
          @click="navigateTo(item.path)"
        >
          <component :is="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- 底部版本 -->
      <div class="app-drawer__footer">
        v0.1.0
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.app-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-drawer__brand {
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-5);
  border-bottom: 1px solid var(--color-border);
}

.app-drawer__brand-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-light);
  letter-spacing: 0.3em;
  color: var(--color-text-primary);
  font-family: var(--font-serif);
}

.app-drawer__brand-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-1);
  letter-spacing: var(--tracking-wide);
}

.app-drawer__nav {
  flex: 1;
  padding: var(--spacing-2) 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.app-drawer__nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  margin: 0 var(--spacing-2);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-fast-out);
  font-family: inherit;
}

@media (hover: hover) and (pointer: fine) {
  .app-drawer__nav-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
}

.app-drawer__nav-item--active {
  background: rgba(45, 212, 168, 0.08);
  color: var(--color-primary);
  font-weight: var(--font-medium);
}

.dark .app-drawer__nav-item--active {
  background: rgba(212, 175, 55, 0.1);
}

.app-drawer__footer {
  padding: var(--spacing-3) var(--spacing-4);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  text-align: center;
}
</style>
