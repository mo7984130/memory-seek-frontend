<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ImageIcon,
  LikeIcon,
  FavoriteIcon,
  User,
  FaceIcon,
  MoreVertical,
} from "@/components/base/Icon/icons";
import Drawer from "@/components/feedback/Drawer/Drawer.vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const route = useRoute();
const router = useRouter();

interface NavItem {
  path: string;
  label: string;
  icon: typeof ImageIcon;
}

const navItems: NavItem[] = [
  { path: "/photos", label: "照片墙", icon: ImageIcon },
  { path: "/persons", label: "人物", icon: FaceIcon },
  { path: "/likes", label: "我喜欢", icon: LikeIcon },
  { path: "/collections", label: "收藏夹", icon: FavoriteIcon },
  { path: "/profile", label: "个人中心", icon: User },
];

// "更多"折叠菜单：当前路由在其分组内时默认展开
const moreItems: NavItem[] = [
  { path: "/unassigned-faces", label: "未分配人脸", icon: FaceIcon },
];

const activePath = computed(() => {
  // 匹配当前路由或其父级
  const path = route.path;
  if (path.startsWith("/collections")) return "/collections";
  if (path.startsWith("/persons")) return "/persons";
  if (path.startsWith("/unassigned-faces")) return "/unassigned-faces";
  return path;
});

// "更多"分组内是否有选中项
const moreActive = computed(() =>
  moreItems.some((item) => activePath.value === item.path),
);

// 展开状态：进入分组内自动展开，离开后自动折叠
const moreOpen = ref(moreActive.value);

watch(
  () => route.path,
  () => {
    if (moreActive.value) {
      moreOpen.value = true;
    } else {
      moreOpen.value = false;
    }
  },
);

function navigateTo(path: string) {
  router.push(path);
  emit("update:modelValue", false);
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

        <!-- 更多 -->
        <div class="app-drawer__more">
          <button
            class="app-drawer__nav-item"
            :class="{ 'app-drawer__nav-item--active': moreActive }"
            type="button"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <MoreVertical :size="16" />
            <span>更多</span>
          </button>
          <Transition name="app-drawer-more">
            <div v-if="moreOpen" class="app-drawer__more-list">
              <button
                v-for="item in moreItems"
                :key="item.path"
                class="app-drawer__nav-item app-drawer__more-item"
                :class="{
                  'app-drawer__nav-item--active': activePath === item.path,
                }"
                type="button"
                @click="navigateTo(item.path)"
              >
                <component :is="item.icon" :size="20" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </nav>

      <!-- 底部版本 -->
      <div class="app-drawer__footer">v0.1.0</div>
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
  background: rgba(120, 120, 120, 0.1);
}

.app-drawer__footer {
  padding: var(--spacing-3) var(--spacing-4);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  text-align: center;
}

.app-drawer__more {
  margin-top: var(--spacing-1);
  width: 100%;
}

.app-drawer__more > .app-drawer__nav-item {
  width: 100%;
}

.app-drawer__nav-item > span {
  flex-shrink: 0;
  white-space: nowrap;
}

.app-drawer__more-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.app-drawer__more-item {
  margin-left: var(--spacing-4);
}

/* 更多子菜单进入/离开动画 */
.app-drawer-more-enter-active,
.app-drawer-more-leave-active {
  transition:
    opacity var(--transition-fast) var(--ease-out),
    transform var(--transition-fast) var(--ease-out);
}

.app-drawer-more-enter-from,
.app-drawer-more-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
