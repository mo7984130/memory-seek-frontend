<!-- src/components/data/CollectionSelector/CollectionSelector.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { visual as visualApi, validation } from "memory-seek-api";
import type { Collection, CollectionBrief } from "memory-seek-api";
import { useCollectionStore } from "@/stores/collection";
import Modal from "@/components/feedback/Modal/Modal.vue";
import Input from "@/components/form/Input/Input.vue";
import IconButton from "@/components/actions/IconButton/IconButton.vue";
import Spinner from "@/components/base/Spinner/Spinner.vue";
import {
  FavoriteIcon,
  Plus,
  Check,
  MoreVertical,
  Pencil,
  Trash2,
  FolderOpen,
} from "@/components/base/Icon/icons";
import "./collection-selector.css";

interface Props {
  modelValue: boolean;
  visualId?: string;
  overlayClass?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [];
}>();

const collectionStore = useCollectionStore();
const createInputRef = ref<InstanceType<typeof Input> | null>(null);

// 状态
const loading = ref(false);
const visualCollections = ref<CollectionBrief[]>([]);
const showCreateForm = ref(false);
const newCollectionName = ref("");
const editingId = ref<string | null>(null);
const editingName = ref("");
const activeMenuId = ref<string | null>(null);

/**
 * 收藏夹列表
 */
const collections = computed(() => collectionStore.collections);

/**
 * 影像所属的收藏夹 ID 集合
 */
const visualCollectionIds = computed(() => {
  return new Set(visualCollections.value.map((c) => c.id));
});

/**
 * 加载收藏夹列表
 */
async function loadCollections() {
  loading.value = true;
  try {
    await collectionStore.fetchCollections();
  } catch (error) {
    console.error("加载收藏夹列表失败:", error);
  } finally {
    loading.value = false;
  }
}

/**
 * 加载影像所属的收藏夹
 */
async function loadVisualCollections() {
  if (!props.visualId) return;
  try {
    const res = await visualApi.collection.getCollectionsByVisual(props.visualId);
    visualCollections.value = res.data;
  } catch (error) {
    console.error("加载影像收藏夹失败:", error);
  }
}

/**
 * 切换影像在收藏夹中的状态
 */
async function toggleCollection(collectionId: string) {
  if (!props.visualId) return;

  const isCollected = visualCollectionIds.value.has(collectionId);
  try {
    if (isCollected) {
      await collectionStore.removeVisualFromCollection(
        collectionId,
        props.visualId,
      );
      visualCollections.value = visualCollections.value.filter(
        (c) => c.id !== collectionId,
      );
    } else {
      await collectionStore.addVisualsToCollection(collectionId, [
        props.visualId,
      ]);
      const collection = collections.value.find((c) => c.id === collectionId);
      if (collection) {
        visualCollections.value.push({
          id: collection.id,
          name: collection.name,
        });
      }
    }
    emit("change");
  } catch (error) {
    console.error("切换收藏夹状态失败:", error);
  }
}

/**
 * 创建新收藏夹
 * 校验由后端统一返回错误消息
 */
async function createCollection() {
  try {
    const newCollection = await collectionStore.createCollection(
      newCollectionName.value.trim(),
    );
    newCollectionName.value = "";
    showCreateForm.value = false;

    // 如果有影像，自动添加到新收藏夹
    if (props.visualId) {
      await collectionStore.addVisualsToCollection(newCollection.id, [
        props.visualId,
      ]);
      visualCollections.value.push({
        id: newCollection.id,
        name: newCollection.name,
      });
      emit("change");
    }
  } catch (error) {
    console.error("创建收藏夹失败:", error);
  }
}

/**
 * 开始编辑收藏夹
 */
function startEdit(collection: Collection) {
  editingId.value = collection.id;
  editingName.value = collection.name;
  activeMenuId.value = null;
}

/**
 * 保存编辑
 * 校验由后端统一返回错误消息
 */
async function saveEdit() {
  if (!editingId.value) return;

  try {
    await collectionStore.updateCollection(editingId.value, {
      name: editingName.value.trim(),
    });
    editingId.value = null;
    editingName.value = "";
  } catch (error) {
    console.error("更新收藏夹失败:", error);
  }
}

/**
 * 取消编辑
 */
function cancelEdit() {
  editingId.value = null;
  editingName.value = "";
}

/**
 * 取消创建
 */
function cancelCreate() {
  showCreateForm.value = false;
  newCollectionName.value = "";
}

/**
 * 删除收藏夹
 */
async function deleteCollectionItem(collectionId: string) {
  try {
    await collectionStore.deleteCollection(collectionId);
    visualCollections.value = visualCollections.value.filter(
      (c) => c.id !== collectionId,
    );
    activeMenuId.value = null;
    emit("change");
  } catch (error) {
    console.error("删除收藏夹失败:", error);
  }
}

/**
 * 切换菜单显示
 */
function toggleMenu(collectionId: string) {
  activeMenuId.value =
    activeMenuId.value === collectionId ? null : collectionId;
}

// 监听弹窗打开
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      activeMenuId.value = null;
      showCreateForm.value = false;
      newCollectionName.value = "";
      editingId.value = null;
      await loadCollections();
      if (props.visualId) {
        await loadVisualCollections();
      }
    }
  },
);

// 监听创建表单显示，自动聚焦输入框
watch(showCreateForm, async (show) => {
  if (show) {
    await nextTick();
    createInputRef.value?.focus();
  }
});
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="sm"
    title="收藏夹"
    :overlay-class="overlayClass"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #default>
      <div class="collection-selector">
        <!-- 创建输入框 -->
        <div
          v-if="showCreateForm"
          class="collection-selector__create-form"
          @click.stop
        >
          <Input
            ref="createInputRef"
            v-model="newCollectionName"
            :placeholder="`输入收藏夹名称（${validation.RULES.collectionName.min}-${validation.RULES.collectionName.max} 字）`"
            size="sm"
            class="collection-selector__create-input"
            @keydown.enter="createCollection"
            @keydown.escape="cancelCreate"
          />
          <button
            class="collection-selector__create-btn"
            type="button"
            :disabled="!newCollectionName.trim()"
            @click="createCollection"
          >
            <Check :size="16" />
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="collection-selector__loading">
          <Spinner size="md" />
        </div>

        <!-- 收藏夹列表 -->
        <div v-else class="collection-selector__list">
          <div
            v-for="collection in collections"
            :key="collection.id"
            class="collection-selector__item"
            @click="visualId && toggleCollection(collection.id)"
          >
            <div class="collection-selector__item-info">
              <div
                class="collection-selector__item-icon"
                :class="{
                  'collection-selector__item-icon--active':
                    visualCollectionIds.has(collection.id),
                }"
              >
                <FavoriteIcon :size="18" />
              </div>
              <div class="collection-selector__item-details">
                <!-- 编辑模式 -->
                <div v-if="editingId === collection.id" @click.stop>
                  <Input
                    v-model="editingName"
                    size="sm"
                    @keydown.enter="saveEdit"
                    @keydown.escape="cancelEdit"
                  />
                </div>
                <!-- 显示模式 -->
                <template v-else>
                  <div class="collection-selector__item-name">
                    {{ collection.name }}
                  </div>
                  <div
                    v-if="collection.description"
                    class="collection-selector__item-desc"
                  >
                    {{ collection.description }}
                  </div>
                  <div class="collection-selector__item-count">
                    {{ collection.visualCount }} 个影像
                  </div>
                </template>
              </div>
            </div>
            <div class="collection-selector__item-action" @click.stop>
              <!-- 已收藏标记 -->
              <div
                v-if="visualId && visualCollectionIds.has(collection.id)"
                class="collection-selector__check"
              >
                <Check :size="14" />
              </div>
              <!-- 更多操作 -->
              <div style="position: relative">
                <IconButton
                  class="collection-selector__menu-btn"
                  @click="toggleMenu(collection.id)"
                >
                  <MoreVertical :size="16" />
                </IconButton>
                <div
                  v-if="activeMenuId === collection.id"
                  class="collection-selector__dropdown"
                >
                  <button
                    class="collection-selector__dropdown-item"
                    @click="startEdit(collection)"
                  >
                    <Pencil :size="14" />
                    编辑
                  </button>
                  <button
                    class="collection-selector__dropdown-item collection-selector__dropdown-item--danger"
                    @click="deleteCollectionItem(collection.id)"
                  >
                    <Trash2 :size="14" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div
            v-if="!loading && collections.length === 0"
            class="collection-selector__empty-hint"
          >
            <FolderOpen
              :size="32"
              class="collection-selector__empty-hint-icon"
            />
            <div class="collection-selector__empty-hint-text">还没有收藏夹</div>
          </div>
        </div>
      </div>
    </template>

    <template #header-extra>
      <IconButton
        class="collection-selector__header-add"
        :class="{ 'collection-selector__header-add--active': showCreateForm }"
        @click="showCreateForm = !showCreateForm"
      >
        <Plus :size="18" />
      </IconButton>
    </template>
  </Modal>
</template>
