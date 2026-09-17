<!-- src/views/VisualDetailView.vue -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { visual as visualApi } from "memory-seek-api";
import type { Visual } from "memory-seek-api";
import VisualViewer from "@/components/visual/VisualViewer.vue";
import Spinner from "@/components/base/Spinner/Spinner.vue";
import { useGoBack } from "@/composables/useGoBack";

// 组件名（KeepAlive include 匹配不到该名称，不会被缓存）
defineOptions({ name: "VisualDetailView" });

const route = useRoute();
const { goBack } = useGoBack("/visuals");

const loading = ref(true);
const loadError = ref(false);
const visual = ref<Visual | null>(null);

async function loadVisual(visualId: string) {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await visualApi.getVisualInfo(visualId);
    visual.value = res.data;
  } catch (error) {
    console.error("[VisualDetailView] 获取影像失败:", error);
    visual.value = null;
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

// 路由参数变化时重新加载（支持在详情页间切换 / 直接输入 URL）
watch(
  () => route.params.id,
  (id) => {
    if (typeof id === "string" && id) {
      loadVisual(id);
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- 加载中：与查看器一致的深色背景，避免闪烁 -->
  <div v-if="loading" class="visual-detail-view">
    <Spinner size="lg" color="#fff" />
  </div>

  <!-- 加载失败 -->
  <div v-else-if="loadError || !visual" class="visual-detail-view">
    <p class="visual-detail-view__error">影像不存在或加载失败</p>
    <button type="button" class="visual-detail-view__back" @click="goBack">
      返回
    </button>
  </div>

  <!-- 影像详情（页面模式的查看器） -->
  <VisualViewer
    v-else
    page-mode
    :model-value="true"
    :visual="visual"
    :initial-show-faces="false"
  />
</template>

<style scoped>
.visual-detail-view {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-visual-viewer);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.visual-detail-view__error {
  margin: 0;
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.75);
}

.visual-detail-view__back {
  padding: var(--spacing-2) var(--spacing-5);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-family: inherit;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out);
}

.visual-detail-view__back:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
