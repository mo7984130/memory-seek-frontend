<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntersectionObserver } from '@vueuse/core'
import { ArrowLeft, Pencil, Trash2 } from '@/components/base/Icon/icons'
import { photo } from 'memory-seek-api'
import type { PhotoResult, CollectionResult } from 'memory-seek-api'
import VirtualWaterfall, { type WaterfallItem } from '@/components/photo/VirtualWaterfall.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import IconButton from '@/components/actions/IconButton/IconButton.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import Modal from '@/components/feedback/Modal/Modal.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const collectionId = route.params.id as string

// 状态
const containerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const collection = ref<CollectionResult | null>(null)
const allPhotos = ref<PhotoResult[]>([])
const columnCount = ref(4)
const containerWidth = ref(0)
const loading = ref(false)
const hasMore = ref(true)
const cursor = ref<string | undefined>(undefined)

// 照片查看器状态
const viewerVisible = ref(false)
const selectedPhoto = ref<PhotoResult | null>(null)

// 编辑弹窗
const showEditModal = ref(false)
const editName = ref('')
const editDesc = ref('')
const saving = ref(false)

// 删除确认
const showDeleteConfirm = ref(false)
const deleting = ref(false)

/**
 * 计算列数和容器宽度
 */
function handleResize() {
  if (!containerRef.value) return
  const style = getComputedStyle(containerRef.value)
  const paddingLeft = parseInt(style.paddingLeft) || 0
  const paddingRight = parseInt(style.paddingRight) || 0
  containerWidth.value = containerRef.value.clientWidth - paddingLeft - paddingRight

  if (containerWidth.value < 640) {
    columnCount.value = 2
  } else if (containerWidth.value < 1024) {
    columnCount.value = 3
  } else if (containerWidth.value < 1440) {
    columnCount.value = 4
  } else {
    columnCount.value = 5
  }
}

/**
 * 加载收藏夹信息
 */
async function loadCollection() {
  try {
    const res = await photo.collection.getCollectionList()
    collection.value = res.data.find((c) => c.id === collectionId) ?? null
  } catch (error) {
    console.error('加载收藏夹信息失败:', error)
  }
}

/**
 * 获取收藏夹照片
 */
async function fetchPhotos() {
  if (loading.value || !hasMore.value) return

  loading.value = true
  try {
    const response = await photo.collection.getCollectionPhotos(collectionId, {
      cursor: cursor.value,
      size: 20,
    })
    const { records, nextCursor, hasMore: more } = response.data

    allPhotos.value.push(...records)
    cursor.value = nextCursor ?? undefined
    hasMore.value = more
  } catch (error) {
    console.error('获取收藏夹照片失败:', error)
  } finally {
    loading.value = false
  }
}

function getPhotoById(id: string | number): PhotoResult {
  return allPhotos.value.find((p) => p.id === id) as PhotoResult
}

function handlePhotoClick(photoItem: PhotoResult) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

function handleLikeChange(photoId: string) {
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isLiked = !target.isLiked
  }
}

function handlePhotoDelete(photoId: string) {
  allPhotos.value = allPhotos.value.filter((p) => p.id !== photoId)
  if (collection.value) {
    collection.value.photoCount = Math.max(0, collection.value.photoCount - 1)
  }
}

async function handleLike(photoItem: PhotoResult) {
  const photoId = photoItem.id as string
  const wasLiked = photoItem.isLiked ?? false

  // 乐观更新 UI
  const target = allPhotos.value.find((p) => p.id === photoId)
  if (target) {
    target.isLiked = !wasLiked
  }

  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId)
    } else {
      await photo.like.likePhoto(photoId)
    }
  } catch (error) {
    // 回滚
    if (target) {
      target.isLiked = wasLiked
    }
    console.error('点赞操作失败:', error)
  }
}

function goBack() {
  router.push('/collections')
}

/**
 * 打开编辑弹窗
 */
function openEdit() {
  if (!collection.value) return
  editName.value = collection.value.name
  editDesc.value = collection.value.description ?? ''
  showEditModal.value = true
}

/**
 * 保存编辑
 */
async function handleSaveEdit() {
  if (!editName.value.trim()) {
    toast.warning('请输入收藏夹名称')
    return
  }

  saving.value = true
  try {
    await photo.collection.updateCollection(collectionId, {
      name: editName.value.trim(),
      description: editDesc.value.trim() || undefined,
    })
    if (collection.value) {
      collection.value.name = editName.value.trim()
      collection.value.description = editDesc.value.trim() || null
    }
    showEditModal.value = false
    toast.success('更新成功')
  } catch (error) {
    console.error('更新收藏夹失败:', error)
  } finally {
    saving.value = false
  }
}

/**
 * 删除收藏夹
 */
async function handleDelete() {
  deleting.value = true
  try {
    await photo.collection.deleteCollection(collectionId)
    toast.success('收藏夹已删除')
    router.push('/collections')
  } catch (error) {
    console.error('删除收藏夹失败:', error)
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

// 触底加载
useIntersectionObserver(sentinelRef, (entries) => {
  const isIntersecting = entries[0]?.isIntersecting || false
  if (isIntersecting && !loading.value && hasMore.value) {
    fetchPhotos()
  }
})

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  loadCollection()
  fetchPhotos()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="collection-detail" ref="containerRef">
    <!-- 头部 -->
    <div class="collection-detail__header">
      <IconButton class="collection-detail__back" @click="goBack">
        <ArrowLeft :size="20" />
      </IconButton>
      <div class="collection-detail__info">
        <div class="collection-detail__name">{{ collection?.name ?? '加载中...' }}</div>
        <div class="collection-detail__count" v-if="collection">
          {{ collection.photoCount }} 张照片
        </div>
      </div>
      <div class="collection-detail__actions">
        <IconButton @click="openEdit">
          <Pencil :size="18" />
        </IconButton>
        <IconButton class="collection-detail__delete-btn" @click="showDeleteConfirm = true">
          <Trash2 :size="18" />
        </IconButton>
      </div>
    </div>

    <!-- 照片瀑布流 -->
    <div class="waterfall-container">
      <VirtualWaterfall
        :items="allPhotos as WaterfallItem[]"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
      >
        <template #default="{ item }">
          <PhotoCard
            :item="getPhotoById(item.id)"
            @click="handlePhotoClick"
            @like="handleLike"
          />
        </template>
      </VirtualWaterfall>

      <div ref="sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!hasMore && allPhotos.length > 0" class="load-sentinel__text">
          已经到底啦 ~
        </span>
        <span v-else-if="!loading && allPhotos.length === 0" class="load-sentinel__text">
          收藏夹里还没有照片
        </span>
      </div>
    </div>

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      @like="handleLikeChange"
      @delete="handlePhotoDelete"
    />

    <!-- 编辑弹窗 -->
    <Modal v-model="showEditModal" size="sm" title="编辑收藏夹">
      <div class="edit-form">
        <div class="edit-form__field">
          <label class="edit-form__label">名称</label>
          <input
            v-model="editName"
            class="edit-form__input"
            placeholder="收藏夹名称"
            maxlength="128"
            @keydown.enter="handleSaveEdit"
          />
        </div>
        <div class="edit-form__field">
          <label class="edit-form__label">描述（可选）</label>
          <input
            v-model="editDesc"
            class="edit-form__input"
            placeholder="简短描述"
            maxlength="256"
          />
        </div>
        <button class="edit-form__submit" type="button" :disabled="saving" @click="handleSaveEdit">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </Modal>

    <!-- 删除确认弹窗 -->
    <Modal v-model="showDeleteConfirm" size="sm" title="删除收藏夹">
      <div class="delete-confirm">
        <p class="delete-confirm__text">
          确定要删除「{{ collection?.name }}」吗？收藏夹内的照片不会被删除。
        </p>
        <div class="delete-confirm__actions">
          <button class="delete-confirm__cancel" type="button" @click="showDeleteConfirm = false">
            取消
          </button>
          <button class="delete-confirm__delete" type="button" :disabled="deleting" @click="handleDelete">
            {{ deleting ? '删除中...' : '删除' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.collection-detail {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.collection-detail__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin: var(--spacing-5) 0;
}

.collection-detail__back {
  color: var(--color-text-primary);
}

.collection-detail__info {
  flex: 1;
}

.collection-detail__name {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.collection-detail__count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.collection-detail__actions {
  display: flex;
  gap: var(--spacing-2);
}

.collection-detail__delete-btn {
  color: var(--color-danger);
}

.waterfall-container {
  position: relative;
  width: 100%;
}

.load-sentinel {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-tertiary);
}

.load-sentinel__text {
  font-size: var(--text-sm);
  position: relative;
}

.load-sentinel__text::before,
.load-sentinel__text::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-border));
}

.load-sentinel__text::before {
  right: calc(100% + 12px);
}

.load-sentinel__text::after {
  left: calc(100% + 12px);
  background: linear-gradient(90deg, var(--color-border), transparent);
}

/* 编辑表单 */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.edit-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.edit-form__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.edit-form__input {
  width: 100%;
  padding: var(--spacing-3);
  border: 2px solid var(--color-border);
  border-radius: var(--input-radius);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--color-bg-input);
  font-family: inherit;
  transition: var(--input-transition);
  outline: none;
  box-sizing: border-box;
}

.edit-form__input:focus {
  border-color: var(--color-border-focus);
  box-shadow: var(--input-focus-shadow);
}

.edit-form__submit {
  width: 100%;
  padding: var(--spacing-3);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--btn-radius);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  font-family: inherit;
  transition: var(--btn-transition);
}

.edit-form__submit:hover {
  background: var(--color-primary-dark);
}

.edit-form__submit:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

/* 删除确认 */
.delete-confirm__text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--spacing-6);
}

.delete-confirm__actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
}

.delete-confirm__cancel {
  padding: var(--spacing-2) var(--spacing-5);
  background: transparent;
  border: 2px solid var(--color-border);
  border-radius: var(--btn-radius);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: var(--btn-transition);
}

.delete-confirm__cancel:hover {
  border-color: var(--color-text-tertiary);
}

.delete-confirm__delete {
  padding: var(--spacing-2) var(--spacing-5);
  background: var(--color-danger);
  color: white;
  border: none;
  border-radius: var(--btn-radius);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  font-family: inherit;
  transition: var(--btn-transition);
}

.delete-confirm__delete:hover {
  opacity: 0.9;
}

.delete-confirm__delete:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .collection-detail {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .collection-detail__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
