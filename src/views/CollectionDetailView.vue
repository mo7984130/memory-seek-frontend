<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Pencil, Trash2 } from "@/components/base/Icon/icons";
import { photo } from "memory-seek-api";
import type { Photo, Collection } from "memory-seek-api";
import { useWaterfallPage } from "@/composables/useWaterfallPage";
import VirtualWaterfall from "@/components/photo/VirtualWaterfall.vue";
import LastPositionButton from "@/components/photo/LastPositionButton.vue";
import PhotoCard from "@/components/photo/PhotoCard.vue";
import PhotoViewer from "@/components/photo/PhotoViewer.vue";
import IconButton from "@/components/actions/IconButton/IconButton.vue";
import Button from "@/components/actions/Button/Button.vue";
import Spinner from "@/components/base/Spinner/Spinner.vue";
import Modal from "@/components/feedback/Modal/Modal.vue";
import Input from "@/components/form/Input/Input.vue";
import BackToTop from "@/components/actions/BackToTop/BackToTop.vue";
import { useToast } from "@/components/feedback/Toast/toast";
import { useGoBack } from "@/composables/useGoBack";
import { markListDirty } from "@/composables/useListDirty";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { goBack } = useGoBack("/collections");

const collectionId = route.params.id as string;

// 瀑布流页面（布局/加载/持久化/自动恢复，每个收藏夹独立存储）
const page = useWaterfallPage({
  storageKey: `collection-${collectionId}`,
  fetch: async ({ cursor }) =>
    (
      await photo.collection.getCollectionPhotos(collectionId, {
        cursor,
        size: 20,
      })
    ).data,
});

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
} = page;

const waterfallViewRef = ref<InstanceType<typeof VirtualWaterfall> | null>(
  null,
);

// 收藏夹信息
const collection = ref<Collection | null>(null);

// 照片查看器状态
const viewerVisible = ref(false);
const selectedPhoto = ref<Photo | null>(null);

// 编辑弹窗
const showEditModal = ref(false);
const editName = ref("");
const editDesc = ref("");
const saving = ref(false);

// 删除确认
const showDeleteConfirm = ref(false);
const deleting = ref(false);

/**
 * 加载收藏夹信息
 */
async function loadCollection() {
  try {
    const res = await photo.collection.getCollectionList();
    collection.value = res.data.find((c) => c.id === collectionId) ?? null;
  } catch (error) {
    console.error("加载收藏夹信息失败:", error);
  }
}

function getPhotoById(id: string | number): Photo | undefined {
  return waterfall.allPhotos.value.find((p) => p.id === id);
}

function handlePhotoClick(photoItem: Photo) {
  selectedPhoto.value = photoItem;
  viewerVisible.value = true;
}

/** 查看器切换照片：更新当前照片并让瀑布流滚动到对应位置 */
function handleViewerNavigate(photoItem: Photo) {
  selectedPhoto.value = photoItem;
  nextTick(() => {
    waterfallViewRef.value?.scrollToItem(photoItem.id, "smooth");
  });
}

/** 查看器触底时加载下一页；返回是否加载到了新照片 */
async function handleLoadMore(): Promise<boolean> {
  if (loading.value || !waterfall.hasMore.value) return false;
  const records = await fetchMore({ cursor: waterfall.cursor.value });
  return records.length > 0;
}

function handleLikeChange(photoId: string, isLiked: boolean) {
  waterfall.updatePhotoLike(photoId, isLiked);
  if (selectedPhoto.value?.id === photoId) {
    selectedPhoto.value.isLiked = isLiked;
  }
}

function handlePhotoDelete(photoId: string) {
  waterfall.removePhoto(photoId);
  if (collection.value) {
    collection.value.photoCount = Math.max(0, collection.value.photoCount - 1);
  }
  markListDirty("collections");
}

async function handleLike(photoItem: Photo) {
  const photoId = photoItem.id as string;
  const wasLiked = photoItem.isLiked ?? false;

  // 乐观更新
  waterfall.updatePhotoLike(photoId, !wasLiked);

  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId);
    } else {
      await photo.like.likePhoto(photoId);
    }
  } catch (error) {
    // 回滚
    waterfall.updatePhotoLike(photoId, wasLiked);
    console.error("[CollectionDetailView] 点赞操作失败:", error);
  }
}

/**
 * 打开编辑弹窗
 */
function openEdit() {
  if (!collection.value) return;
  editName.value = collection.value.name;
  editDesc.value = collection.value.description ?? "";
  showEditModal.value = true;
}

/**
 * 保存编辑
 */
async function handleSaveEdit() {
  if (!editName.value.trim()) {
    toast.warning("请输入收藏夹名称");
    return;
  }

  saving.value = true;
  try {
    await photo.collection.updateCollection(collectionId, {
      name: editName.value.trim(),
      description: editDesc.value.trim() || undefined,
    });
    if (collection.value) {
      collection.value.name = editName.value.trim();
      collection.value.description = editDesc.value.trim() || null;
    }
    showEditModal.value = false;
    toast.success("更新成功");
    markListDirty("collections");
  } catch (error) {
    console.error("更新收藏夹失败:", error);
  } finally {
    saving.value = false;
  }
}

/**
 * 删除收藏夹
 */
async function handleDelete() {
  deleting.value = true;
  try {
    await photo.collection.deleteCollection(collectionId);
    toast.success("收藏夹已删除");
    markListDirty("collections");
    router.push("/collections");
  } catch (error) {
    console.error("删除收藏夹失败:", error);
  } finally {
    deleting.value = false;
    showDeleteConfirm.value = false;
  }
}

onMounted(() => {
  loadCollection();
  initialize(() => waterfallViewRef.value);
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<template>
  <div class="collection-detail" :ref="page.containerRef">
    <!-- 头部 -->
    <div class="collection-detail__header">
      <IconButton class="collection-detail__back" @click="goBack">
        <ArrowLeft :size="20" />
      </IconButton>
      <div class="collection-detail__info">
        <div class="collection-detail__name">
          {{ collection?.name ?? "加载中..." }}
        </div>
        <div class="collection-detail__count" v-if="collection">
          {{ collection.photoCount }} 张照片
        </div>
      </div>
      <div class="collection-detail__actions">
        <IconButton @click="openEdit">
          <Pencil :size="18" />
        </IconButton>
        <IconButton
          class="collection-detail__delete-btn"
          @click="showDeleteConfirm = true"
        >
          <Trash2 :size="18" />
        </IconButton>
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
        <span
          v-else-if="
            !waterfall.hasMore.value && waterfall.allPhotos.value.length > 0
          "
          class="load-sentinel__text"
        >
          已经到底啦 ~
        </span>
        <span
          v-else-if="!loading && waterfall.allPhotos.value.length === 0"
          class="load-sentinel__text"
        >
          收藏夹里还没有照片
        </span>
      </div>
    </div>

    <!-- 回到上次浏览位置（按钮触发恢复） -->
    <LastPositionButton
      :storage-key="`collection-${collectionId}`"
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
      @navigate="handleViewerNavigate"
    />

    <!-- 编辑弹窗 -->
    <Modal v-model="showEditModal" size="sm" title="编辑收藏夹">
      <div class="edit-form">
        <div class="edit-form__field">
          <label class="edit-form__label">名称</label>
          <Input
            v-model="editName"
            placeholder="收藏夹名称"
            @keydown.enter="handleSaveEdit"
          />
        </div>
        <div class="edit-form__field">
          <label class="edit-form__label">描述（可选）</label>
          <Input v-model="editDesc" placeholder="简短描述" />
        </div>
        <Button type="button" :loading="saving" block @click="handleSaveEdit">
          保存
        </Button>
      </div>
    </Modal>

    <!-- 删除确认弹窗 -->
    <Modal v-model="showDeleteConfirm" size="sm" title="删除收藏夹">
      <div class="delete-confirm">
        <p class="delete-confirm__text">
          确定要删除「{{ collection?.name }}」吗？收藏夹内的照片不会被删除。
        </p>
        <div class="delete-confirm__actions">
          <Button
            variant="outline"
            type="button"
            @click="showDeleteConfirm = false"
          >
            取消
          </Button>
          <Button
            variant="danger"
            type="button"
            :loading="deleting"
            @click="handleDelete"
          >
            删除
          </Button>
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
  content: "";
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

@media (max-width: 768px) {
  .collection-detail {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .collection-detail__header {
    margin: var(--spacing-4) 0;
  }
}
</style>
