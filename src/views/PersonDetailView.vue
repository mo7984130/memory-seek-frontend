<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, FaceIcon } from '@/components/base/Icon/icons'
import { photo } from 'memory-seek-api'
import type { Person, Photo } from 'memory-seek-api'
import { useWaterfallPage } from '@/composables/useWaterfallPage'
import VirtualWaterfall from '@/components/photo/VirtualWaterfall.vue'
import LastPositionButton from '@/components/photo/LastPositionButton.vue'
import PhotoCard from '@/components/photo/PhotoCard.vue'
import PhotoViewer from '@/components/photo/PhotoViewer.vue'
import IconButton from '@/components/actions/IconButton/IconButton.vue'
import Button from '@/components/actions/Button/Button.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import Modal from '@/components/feedback/Modal/Modal.vue'
import Input from '@/components/form/Input/Input.vue'
import BackToTop from '@/components/actions/BackToTop/BackToTop.vue'
import { useToast } from '@/components/feedback/Toast/toast'
import { useGoBack } from '@/composables/useGoBack'
import { usePersonSearch } from '@/composables/usePersonSearch'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { goBack } = useGoBack('/persons')

const personId = route.params.id as string

// 瀑布流页面（布局/加载/持久化/自动恢复，每个人物独立存储）
const page = useWaterfallPage({
  storageKey: `person-${personId}`,
  fetch: async ({ cursor }) =>
    (await photo.person.getPersonPhotos(personId, { cursor, size: 20 })).data,
})

const {
  waterfall,
  columnCount,
  containerWidth,
  loading,
  groups,
  fetchMore,
  handleTopItemChange,
  restoreToLastPosition,
  initialize,
  dispose,
} = page

const waterfallViewRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null)

// 人物信息
const person = ref<Person | null>(null)

// 照片查看器状态
const viewerVisible = ref(false)
const selectedPhoto = ref<Photo | null>(null)

// 改名弹窗
const showRenameDialog = ref(false)
const renameName = ref('')
const renaming = ref(false)

// 合并弹窗
const showMergeDialog = ref(false)
const mergeTargetId = ref('')
const merging = ref(false)

// 合并目标人物（游标分页搜索，排除当前人物）
const {
  keyword: mergeKeyword,
  persons: mergePersons,
  loading: mergeLoading,
  loaded: mergeLoaded,
  hasMore: mergeHasMore,
  reload: reloadMerge,
  reset: resetMerge,
  onScroll: onMergeScroll,
} = usePersonSearch({ excludeId: () => personId })

// 删除确认
const showDeleteConfirm = ref(false)
const deleting = ref(false)

function getPhotoById(id: string | number): Photo | undefined {
  return waterfall.allPhotos.value.find((p) => p.id === id)
}

/**
 * 加载人物信息：
 * 优先取列表页通过路由 state 传入的人物对象（免请求、即时渲染），
 * 兜底分页拉取人物列表按 id 查找（支持直接刷新/直达链接/从照片墙跳转）
 * @returns 是否找到该人物
 */
async function loadPerson(): Promise<boolean> {
  const statePerson = (window.history.state as { person?: Person } | null)?.person
  if (statePerson?.id === personId) {
    person.value = statePerson
    return true
  }
  try {
    let cursor: string | null = null
    for (;;) {
      const res = await photo.person.getPersons({ cursor, size: 32 })
      const page = res.data
      const found = page.records.find((p) => p.id === personId)
      if (found) {
        person.value = found
        return true
      }
      if (!page.hasMore || !page.nextCursor) break
      cursor = page.nextCursor
    }
    person.value = null
    return false
  } catch (error) {
    console.error('加载人物信息失败:', error)
    return person.value !== null
  }
}

function handlePhotoClick(photoItem: Photo) {
  selectedPhoto.value = photoItem
  viewerVisible.value = true
}

/** 查看器切换照片：更新当前照片并让瀑布流滚动到对应位置 */
function handleViewerNavigate(photoItem: Photo) {
  selectedPhoto.value = photoItem
  nextTick(() => {
    waterfallViewRef.value?.scrollToItem(photoItem.id, 'smooth')
  })
}

/** 查看器触底时加载下一页；返回是否加载到了新照片 */
async function handleLoadMore(): Promise<boolean> {
  if (loading.value || !waterfall.hasMore.value) return false
  const records = await fetchMore({ cursor: waterfall.cursor.value })
  return records.length > 0
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  waterfall.updatePhotoLike(photoId, isLiked)
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked
  }
}

function handlePhotoDelete(photoId: string) {
  waterfall.removePhoto(photoId)
}

async function handleLike(photoItem: Photo) {
  const photoId = photoItem.id as string
  const wasLiked = photoItem.isLiked ?? false

  // 乐观更新
  waterfall.updatePhotoLike(photoId, !wasLiked)

  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId)
    } else {
      await photo.like.likePhoto(photoId)
    }
  } catch (error) {
    // 回滚
    waterfall.updatePhotoLike(photoId, wasLiked)
    console.error('[PersonDetailView] 点赞操作失败:', error)
  }
}

// ---- 改名 ----
function openRenameDialog() {
  if (!person.value) return
  renameName.value = person.value.name
  showRenameDialog.value = true
}

async function handleRename() {
  const name = renameName.value.trim()
  if (!name) {
    toast.warning('请输入人物名称')
    return
  }
  renaming.value = true
  try {
    await photo.person.renamePerson(personId, name)
    if (person.value) person.value.name = name
    showRenameDialog.value = false
    toast.success('改名成功')
  } catch (error) {
    console.error('重命名人物失败:', error)
    toast.error('重命名失败')
  } finally {
    renaming.value = false
  }
}

// ---- 合并 ----
function openMergeDialog() {
  showMergeDialog.value = true
  mergeTargetId.value = ''
  resetMerge()
  reloadMerge()
}

async function handleMerge() {
  if (!mergeTargetId.value) return
  merging.value = true
  try {
    await photo.person.mergePerson(personId, mergeTargetId.value)
    toast.success('合并成功')
    router.push('/persons')
  } catch (error) {
    console.error('合并人物失败:', error)
    toast.error('合并失败')
  } finally {
    merging.value = false
  }
}

// ---- 删除 ----
async function handleDelete() {
  deleting.value = true
  try {
    await photo.person.deletePerson(personId)
    toast.success('人物已删除')
    router.push('/persons')
  } catch (error) {
    console.error('删除人物失败:', error)
    toast.error('删除失败')
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

/** 照片查看器内人脸操作后刷新人物信息；人物已不存在则返回列表 */
async function handleFacesUpdated() {
  const found = await loadPerson()
  if (!found) {
    toast.info('该人物已不存在')
    router.push('/persons')
  }
}

onMounted(() => {
  loadPerson()
  initialize(() => waterfallViewRef.value)
})

onBeforeUnmount(() => {
  dispose()
})
</script>

<template>
  <div class="person-detail" :ref="page.containerRef">
    <!-- 头部 -->
    <div class="person-detail__header">
      <IconButton class="person-detail__back" @click="goBack">
        <ArrowLeft :size="20" />
      </IconButton>
      <div class="person-detail__avatar">
        <img
          v-if="person?.coverToken"
          :src="photo.getImgUrl(person.coverToken)"
          class="person-detail__avatar-img"
          alt=""
        />
        <FaceIcon v-else :size="24" class="person-detail__avatar-icon" />
      </div>
      <div class="person-detail__info">
        <div class="person-detail__name">{{ person?.name ?? '加载中...' }}</div>
        <div class="person-detail__count" v-if="person">
          {{ Number(person.faceCount) }} 张照片
        </div>
      </div>
      <div class="person-detail__actions">
        <Button variant="outline" size="sm" type="button" @click="openRenameDialog">
          改名
        </Button>
        <Button variant="outline" size="sm" type="button" @click="openMergeDialog">
          合并
        </Button>
        <Button variant="danger" size="sm" type="button" @click="showDeleteConfirm = true">
          删除
        </Button>
      </div>
    </div>

    <!-- 照片瀑布流 -->
    <div class="waterfall-container">
      <VirtualWaterfall
        ref="waterfallViewRef"
        :groups="groups"
        :column-count="columnCount"
        :container-width="containerWidth"
        :gap="16"
        @top-item-change="handleTopItemChange"
      >
        <template #default="{ item }">
          <PhotoCard
            v-if="getPhotoById(item.id)"
            :item="getPhotoById(item.id)!"
            @click="handlePhotoClick"
            @like="handleLike"
          />
        </template>
      </VirtualWaterfall>

      <div :ref="page.sentinelRef" class="load-sentinel">
        <Spinner v-if="loading" />
        <span v-else-if="!waterfall.hasMore.value && waterfall.allPhotos.value.length > 0" class="load-sentinel__text">
          已经到底啦 ~
        </span>
        <span v-else-if="!loading && waterfall.allPhotos.value.length === 0" class="load-sentinel__text">
          该人物还没有照片
        </span>
      </div>
    </div>

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton
      :storage-key="`person-${personId}`"
      @restore="restoreToLastPosition"
    />

    <!-- 回到顶部 -->
    <BackToTop />

    <!-- 照片查看器 -->
    <PhotoViewer
      v-model="viewerVisible"
      :photo="selectedPhoto"
      :photos="waterfall.allPhotos.value"
      :load-more="handleLoadMore"
      @like="handleLikeChange"
      @delete="handlePhotoDelete"
      @faces-updated="handleFacesUpdated"
      @navigate="handleViewerNavigate"
    />

    <!-- 改名弹窗 -->
    <Modal v-model="showRenameDialog" size="sm" title="改名">
      <div class="person-detail__dialog">
        <div class="person-detail__dialog-field">
          <label class="person-detail__dialog-label">人物名称</label>
          <Input v-model="renameName" placeholder="输入新名称" @keydown.enter="handleRename" />
        </div>
        <Button type="button" block :loading="renaming" :disabled="!renameName.trim()" @click="handleRename">
          保存
        </Button>
      </div>
    </Modal>

    <!-- 合并弹窗 -->
    <Modal v-model="showMergeDialog" size="sm" title="合并人物">
      <div class="person-detail__dialog">
        <p class="person-detail__merge-tip">
          将「{{ person?.name }}」合并到目标人物，合并后当前人物将被删除。
        </p>
        <Input v-model="mergeKeyword" placeholder="输入关键词筛选人物" />
        <div class="person-detail__merge-list" @scroll="onMergeScroll">
          <button
            v-for="p in mergePersons"
            :key="p.id"
            type="button"
            class="person-detail__merge-item"
            :class="{ 'person-detail__merge-item--active': mergeTargetId === p.id }"
            @click="mergeTargetId = p.id"
          >
            <span>{{ p.name }}</span>
            <span class="person-detail__merge-count">{{ Number(p.faceCount) }} 张照片</span>
          </button>
          <div v-if="mergeLoading" class="person-detail__merge-empty">加载中...</div>
          <div v-else-if="mergeLoaded && mergePersons.length === 0" class="person-detail__merge-empty">
            未找到其他人物
          </div>
          <div v-else-if="!mergeHasMore && mergePersons.length > 0" class="person-detail__merge-empty">
            已经到底啦 ~
          </div>
        </div>
        <Button type="button" block :loading="merging" :disabled="!mergeTargetId" @click="handleMerge">
          确认合并
        </Button>
      </div>
    </Modal>

    <!-- 删除确认弹窗 -->
    <Modal v-model="showDeleteConfirm" size="sm" title="删除人物">
      <div class="person-detail__dialog">
        <p class="person-detail__delete-text">
          确定要删除「{{ person?.name }}」吗？该人物的人脸将变为未分配，照片不会被删除。
        </p>
        <div class="person-detail__delete-actions">
          <Button variant="outline" type="button" @click="showDeleteConfirm = false">取消</Button>
          <Button variant="danger" type="button" :loading="deleting" @click="handleDelete">删除</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.person-detail {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
}

.person-detail__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin: var(--spacing-5) 0;
}

.person-detail__back {
  color: var(--color-text-primary);
}

.person-detail__avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-hover);
}

.person-detail__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.person-detail__avatar-icon {
  color: var(--color-text-tertiary);
  opacity: 0.6;
}

.person-detail__info {
  flex: 1;
}

.person-detail__name {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.person-detail__count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.person-detail__actions {
  display: flex;
  gap: var(--spacing-2);
}

.person-detail__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.person-detail__dialog-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.person-detail__dialog-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.person-detail__merge-tip {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

.person-detail__merge-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-1);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.person-detail__merge-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.person-detail__merge-item:hover {
  background: var(--color-bg-hover);
}

.person-detail__merge-item--active {
  background: rgba(45, 212, 168, 0.12);
}

.dark .person-detail__merge-item--active {
  background: rgba(120, 120, 120, 0.15);
}

.person-detail__merge-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.person-detail__merge-empty {
  padding: var(--spacing-4);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.person-detail__delete-text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--spacing-6);
}

.person-detail__delete-actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
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

@media (max-width: 768px) {
  .person-detail {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .person-detail__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
