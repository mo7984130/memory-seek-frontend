<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, FolderOpen } from '@/components/base/Icon/icons'
import { photo } from 'memory-seek-api'
import type { CollectionResult } from 'memory-seek-api'
import IconButton from '@/components/actions/IconButton/IconButton.vue'
import Button from '@/components/actions/Button/Button.vue'
import Card from '@/components/data/Card/Card.vue'
import Modal from '@/components/feedback/Modal/Modal.vue'
import Input from '@/components/form/Input/Input.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const collections = ref<CollectionResult[]>([])
const showCreateModal = ref(false)
const newCollectionName = ref('')
const newCollectionDesc = ref('')
const creating = ref(false)

/**
 * 封面渐变色 — 根据 index 循环
 */
const gradients = [
  'linear-gradient(135deg, #ccfbf1, #99f6e4)',
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #dbeafe, #93c5fd)',
  'linear-gradient(135deg, #fce7f3, #f9a8d4)',
  'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
  'linear-gradient(135deg, #d1fae5, #6ee7b7)',
]

function getGradient(index: number) {
  return gradients[index % gradients.length]
}

/**
 * 加载收藏夹列表
 */
async function loadCollections() {
  loading.value = true
  try {
    const res = await photo.collection.getCollectionList()
    collections.value = res.data
  } catch (error) {
    console.error('加载收藏夹失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 进入收藏夹详情
 */
function enterCollection(collection: CollectionResult) {
  router.push(`/collections/${collection.id}`)
}

/**
 * 创建收藏夹
 */
async function handleCreate() {
  const name = newCollectionName.value.trim()
  if (!name) {
    toast.warning('请输入收藏夹名称')
    return
  }

  creating.value = true
  try {
    const res = await photo.collection.createCollection({
      name,
      description: newCollectionDesc.value.trim() || undefined,
    })
    collections.value.push(res.data)
    showCreateModal.value = false
    newCollectionName.value = ''
    newCollectionDesc.value = ''
    toast.success('收藏夹创建成功')
  } catch (error) {
    console.error('创建收藏夹失败:', error)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadCollections()
})
</script>

<template>
  <div class="collections-view">
    <!-- 标题栏 -->
    <div class="collections-view__header">
      <div class="collections-view__title-group">
        <div class="collections-view__count" v-if="collections.length > 0">
          {{ collections.length }} 个收藏夹
        </div>
      </div>
      <IconButton class="collections-view__add-btn" @click="showCreateModal = true">
        <Plus :size="20" />
      </IconButton>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="collections-view__loading">
      <Spinner size="lg" />
    </div>

    <!-- 收藏夹网格 -->
    <div v-else-if="collections.length > 0" class="collections-view__grid">
      <Card
        v-for="(collection, index) in collections"
        :key="collection.id"
        shadow="sm"
        padding="none"
        hoverable
        class="collection-card"
        @click="enterCollection(collection)"
      >
        <div class="collection-card__cover" :style="{ background: getGradient(index) }">
          <img
            v-if="collection.coverToken"
            :src="photo.getImgUrl(collection.coverToken)"
            class="collection-card__cover-img"
            alt=""
          />
          <FolderOpen v-else :size="32" class="collection-card__cover-icon" />
        </div>
        <div class="collection-card__info">
          <div class="collection-card__name">{{ collection.name }}</div>
          <div class="collection-card__count">{{ collection.photoCount }} 张照片</div>
        </div>
      </Card>
    </div>

    <!-- 空状态 -->
    <div v-else class="collections-view__empty">
      <FolderOpen :size="56" class="collections-view__empty-icon" />
      <div class="collections-view__empty-text">暂无收藏夹</div>
      <div class="collections-view__empty-hint">点击右上角 + 创建第一个收藏夹</div>
    </div>

    <!-- 创建收藏夹弹窗 -->
    <Modal
      v-model="showCreateModal"
      size="sm"
      title="新建收藏夹"
    >
      <div class="create-form">
        <div class="create-form__field">
          <label class="create-form__label">名称</label>
          <Input
            v-model="newCollectionName"
            placeholder="输入收藏夹名称"
            @keydown.enter="handleCreate"
          />
        </div>
        <div class="create-form__field">
          <label class="create-form__label">描述（可选）</label>
          <Input
            v-model="newCollectionDesc"
            placeholder="简短描述"
          />
        </div>
        <Button
          type="button"
          :loading="creating"
          block
          @click="handleCreate"
        >
          创建
        </Button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.collections-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.collections-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: var(--spacing-5) 0;
}

.collections-view__title-group {
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
}

.collections-view__count {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.collections-view__add-btn {
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  width: 36px;
  height: 36px;
}

.collections-view__loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-16) 0;
}

.collections-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-5);
  padding-left: var(--spacing-8);
}

.collection-card {
  /* Card 组件已处理基础样式 */
}

.collection-card__cover {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.collection-card__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.collection-card__cover-icon {
  color: rgba(0, 0, 0, 0.2);
}

.collection-card__info {
  padding: var(--spacing-3);
}

.collection-card__name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-card__count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-1);
}

.collections-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16) 0;
  color: var(--color-text-tertiary);
}

.collections-view__empty-icon {
  margin-bottom: var(--spacing-4);
  opacity: 0.5;
}

.collections-view__empty-text {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

.collections-view__empty-hint {
  font-size: var(--text-sm);
  margin-top: var(--spacing-2);
}

/* 创建表单 */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.create-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.create-form__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .collections-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .collections-view__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-3);
    padding-left: var(--spacing-2);
  }

  .collections-view__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
