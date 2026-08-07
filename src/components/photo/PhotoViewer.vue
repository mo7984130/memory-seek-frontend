<!-- src/components/photo/PhotoViewer.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { photo as photoApi, validation } from "memory-seek-api";
import type { Face, Photo } from "memory-seek-api";
import {
  ChevronLeft,
  ChevronRight,
  LoadingIcon,
} from "@/components/base/Icon/icons";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/components/feedback/Toast/toast";
import Modal from "@/components/feedback/Modal/Modal.vue";
import CollectionSelector from "@/components/data/CollectionSelector/CollectionSelector.vue";
import PhotoToolbar from "./PhotoToolbar.vue";
import PhotoComments from "./PhotoComments.vue";
import Input from "@/components/form/Input/Input.vue";
import Button from "@/components/actions/Button/Button.vue";
import { usePersonSearch } from "@/composables/usePersonSearch";
import "./photo-viewer.css";

interface Props {
  modelValue: boolean;
  photo: Photo | null;
  /** 照片列表（用于上一张/下一张切换） */
  photos?: Photo[];
  /** 到达已加载列表末尾时触发加载下一页；返回是否加载到了新照片 */
  loadMore?: () => Promise<boolean>;
  /** 打开查看器时自动开启人脸框（默认关闭，保持现有页面行为） */
  initialShowFaces?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  initialShowFaces: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  like: [photoId: string, isLiked: boolean];
  delete: [photoId: string];
  "faces-updated": [];
  navigate: [photo: Photo];
}>();

const authStore = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

// ---- 状态 ----
const zoom = ref(1);
const baseZoom = ref(1);
const rotation = ref(0);
const translateX = ref(0);
const translateY = ref(0);
const imageWidth = ref(0);
const imageHeight = ref(0);
const showComments = ref(false);
const showCollectionSelector = ref(false);
const showOriginal = ref(false);
const loadingOriginal = ref(false);
const refreshing = ref(false);
const showDeleteConfirm = ref(false);
const deleting = ref(false);
// 人脸显示时是否展示人物名称
const showFaceLabels = ref(true);

// ---- 人脸状态 ----
const showFaces = ref(false);
const faces = ref<Face[]>([]);
const facesLoaded = ref(false);
const loadingFaces = ref(false);
const facesError = ref(false);

// ---- 人脸操作状态 ----
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const activeFace = ref<Face | null>(null);
const showChangeBelongingDialog = ref(false);
const showRenameDialog = ref(false);
const showDeleteFaceConfirm = ref(false);
const changingBelonging = ref(false);
const renaming = ref(false);
const unassigning = ref(false);
const deletingFace = ref(false);
const renameName = ref("");
const targetPersonId = ref("");

// 归属目标人物（游标分页搜索）
const {
  keyword: personKeyword,
  persons,
  loading: personsLoading,
  loaded: personsLoaded,
  hasMore: personsHasMore,
  reload: reloadPersons,
  reset: resetPersons,
  onScroll: onPersonsScroll,
} = usePersonSearch();

// 拖拽状态
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartTranslateX = ref(0);
const dragStartTranslateY = ref(0);

// 原图缓存（仅当前会话有效）
const originalUrl = ref<string | null>(null);

// 图片加载状态
const imageLoading = ref(true);

// 缩放常量（相对于 baseZoom 的倍数）
const ZOOM_RATIO_MIN = 0.25;
const ZOOM_RATIO_MAX = 4;
const ZOOM_RATIO_STEP = 0.25;

// ---- 计算属性 ----

/** 是否有原图 token */
const hasOriginalToken = computed(() => !!props.photo?.originalToken);

/** 当前显示的图片 URL */
const imageUrl = computed(() => {
  if (!props.photo) return null;

  // 显示原图：用缓存或 token URL
  if (showOriginal.value) {
    return (
      originalUrl.value ||
      (props.photo.originalToken
        ? photoApi.getImgUrl(props.photo.originalToken)
        : null)
    );
  }

  // 显示预览图：直接用 token URL
  const token = props.photo.previewToken || props.photo.thumbnailToken;
  return token ? photoApi.getImgUrl(token) : null;
});

/** 图片 transform 样式（zoom 相对于 baseZoom 的比值） */
const imageTransform = computed(() => {
  const scaleRatio = zoom.value / baseZoom.value;
  return `translate(-50%, -50%) scale(${scaleRatio}) rotate(${rotation.value}deg) translate(${translateX.value / scaleRatio}px, ${translateY.value / scaleRatio}px)`;
});

/** 是否已点赞 */
const isFavorited = computed(() => props.photo?.isLiked ?? false);

/** 是否已收藏 */
const isCollected = computed(() => props.photo?.isCollected ?? false);

/** 是否是照片上传者 */
const isOwner = computed(() => {
  if (!props.photo || !authStore.userId) return false;
  return props.photo.userId === authStore.userId;
});

// ---- 上一张/下一张 ----

/** 当前照片在列表中的下标；photo 不在列表中（如已删除）时为 -1 */
const currentIndex = computed(() => {
  const photo = props.photo;
  if (!photo || !props.photos) return -1;
  return props.photos.findIndex((p) => p.id === photo.id);
});

const hasPrev = computed(() => currentIndex.value > 0);

const hasNext = computed(
  () =>
    props.photos != null &&
    currentIndex.value >= 0 &&
    currentIndex.value < props.photos.length - 1,
);

/** 触底加载下一页的进行中状态 */
const loadingMore = ref(false);
/** 加载下一页后是否仍有更多照片（到底后置为 false，隐藏下一张按钮） */
const hasMoreInViewer = ref(true);

/** 是否显示"下一张"按钮：列表内还有下一张，或可继续触底加载 */
const showNext = computed(
  () =>
    currentIndex.value >= 0 &&
    (hasNext.value ||
      loadingMore.value ||
      (!!props.loadMore && hasMoreInViewer.value)),
);

function goPrev() {
  if (!props.photos || !hasPrev.value || loadingMore.value) return;
  emit("navigate", props.photos[currentIndex.value - 1]!);
}

async function goNext() {
  if (loadingMore.value) return;
  if (hasNext.value) {
    emit("navigate", props.photos![currentIndex.value + 1]!);
    return;
  }
  // 已到达列表末尾：尝试自动加载下一页，加载完成后再跳转到新照片
  if (!props.loadMore || !hasMoreInViewer.value) return;
  loadingMore.value = true;
  try {
    const loaded = await props.loadMore();
    hasMoreInViewer.value = !!loaded;
    if (loaded && props.modelValue) {
      // 等待父组件将新列表传入 props 后重新定位
      await nextTick();
      if (hasNext.value) {
        emit("navigate", props.photos![currentIndex.value + 1]!);
      }
    }
  } finally {
    loadingMore.value = false;
  }
}

// ---- 缩放控制 ----
function zoomIn() {
  const step = baseZoom.value * ZOOM_RATIO_STEP;
  zoom.value = Math.min(zoom.value + step, baseZoom.value * ZOOM_RATIO_MAX);
}

function zoomOut() {
  const step = baseZoom.value * ZOOM_RATIO_STEP;
  zoom.value = Math.max(zoom.value - step, baseZoom.value * ZOOM_RATIO_MIN);
}

// ---- 图片加载后计算适配尺寸 ----
function handleImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) return;

  // 可用区域（减去工具栏和边距空间）
  const availW = window.innerWidth - 80;
  const availH = window.innerHeight - 120;

  const scale = Math.min(availW / naturalW, availH / naturalH);
  imageWidth.value = Math.round(naturalW * scale);
  imageHeight.value = Math.round(naturalH * scale);

  // 设置初始缩放为适配缩放
  baseZoom.value = scale;
  zoom.value = scale;
  rotation.value = 0;

  // 图片加载完成
  imageLoading.value = false;
}

// ---- 监听 photo 变化，重置加载状态 ----
watch(
  () => props.photo,
  () => {
    imageLoading.value = true;
    // 切换照片时重置人脸状态
    showFaces.value = props.initialShowFaces;
    faces.value = [];
    facesLoaded.value = false;
    loadingFaces.value = false;
    facesError.value = false;
    // 重置人脸操作状态
    closeFaceContextMenu();
    showChangeBelongingDialog.value = false;
    showRenameDialog.value = false;
    showDeleteFaceConfirm.value = false;
    // 自动开启人脸框：加载该照片的人脸
    if (props.initialShowFaces && !facesLoaded.value) {
      loadFaces();
    }
  },
);

// ---- 旋转控制（每次 90°） ----
function rotate() {
  rotation.value = (rotation.value + 90) % 360;
}

// ---- 重置缩放、旋转和位置 ----
function resetView() {
  zoom.value = baseZoom.value;
  rotation.value = 0;
  translateX.value = 0;
  translateY.value = 0;
}

// ---- 拖拽控制（鼠标） ----
function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return; // 只响应左键
  isDragging.value = true;
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  dragStartTranslateX.value = translateX.value;
  dragStartTranslateY.value = translateY.value;
  event.preventDefault();
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return;
  const dx = event.clientX - dragStartX.value;
  const dy = event.clientY - dragStartY.value;
  translateX.value = dragStartTranslateX.value + dx;
  translateY.value = dragStartTranslateY.value + dy;
}

function handleMouseUp() {
  isDragging.value = false;
}

// ---- 拖拽控制（触摸） ----
function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return; // 只响应单指触摸
  const touch = event.touches[0]!;
  isDragging.value = true;
  dragStartX.value = touch.clientX;
  dragStartY.value = touch.clientY;
  dragStartTranslateX.value = translateX.value;
  dragStartTranslateY.value = translateY.value;
}

function handleTouchMove(event: TouchEvent) {
  if (!isDragging.value || event.touches.length !== 1) return;
  const touch = event.touches[0]!;
  const dx = touch.clientX - dragStartX.value;
  const dy = touch.clientY - dragStartY.value;
  translateX.value = dragStartTranslateX.value + dx;
  translateY.value = dragStartTranslateY.value + dy;
  event.preventDefault();
}

function handleTouchEnd() {
  isDragging.value = false;
}

// ---- 点赞切换 ----
async function toggleFavorite() {
  if (!props.photo) return;
  const wasLiked = isFavorited.value;
  try {
    if (wasLiked) {
      await photoApi.like.unlikePhoto(props.photo.id);
    } else {
      await photoApi.like.likePhoto(props.photo.id);
    }
    // 通知父组件更新状态
    emit("like", props.photo.id, !wasLiked);
  } catch (error) {
    console.error("点赞操作失败:", error);
  }
}

// ---- 收藏夹选择器切换 ----
function toggleCollect() {
  showCollectionSelector.value = !showCollectionSelector.value;
}

// ---- 评论抽屉切换 ----
function toggleComments() {
  showComments.value = !showComments.value;
  // 评论与人脸框互斥
  if (showComments.value) {
    showFaces.value = false;
  }
}

// ---- 人脸框开关 ----
function toggleFaces() {
  showFaces.value = !showFaces.value;
  // 人脸框与评论互斥
  if (showFaces.value) {
    showComments.value = false;
  }
  // 首次打开时拉取人脸数据
  if (showFaces.value && !facesLoaded.value) {
    loadFaces();
  }
}

// ---- 人脸名称显示开关 ----
function toggleFaceLabels() {
  showFaceLabels.value = !showFaceLabels.value;
}

// ---- 拉取人脸列表 ----
async function loadFaces() {
  if (!props.photo || loadingFaces.value) return;
  loadingFaces.value = true;
  facesError.value = false;
  try {
    faces.value = (await photoApi.face.getFaces(props.photo.id)).data;
    facesLoaded.value = true;
    // 开启人脸模式但未检测到人脸时，给出轻提示
    if (faces.value.length === 0) {
      toast.info("未检测到人脸");
    }
  } catch (error) {
    console.error("获取人脸失败:", error);
    facesError.value = true;
    toast.error("人脸信息加载失败");
  } finally {
    loadingFaces.value = false;
  }
}

// ---- 人脸框坐标 ----
/**
 * 人脸框样式：百分比定位（overlay 与图片同尺寸同 transform，缩放/旋转/拖拽由 CSS transform 统一处理，
 * 因此 bbox 直接使用原始归一化坐标，无需再按旋转角度换算，否则会双重旋转）
 */
function faceBoxStyle(face: Face) {
  const b = face.bbox;
  return {
    left: `${(b.x1 * 100).toFixed(3)}%`,
    top: `${(b.y1 * 100).toFixed(3)}%`,
    width: `${((b.x2 - b.x1) * 100).toFixed(3)}%`,
    height: `${((b.y2 - b.y1) * 100).toFixed(3)}%`,
  };
}

// ---- 人脸操作 ----
function handleFaceContextMenu(event: MouseEvent, face: Face) {
  event.preventDefault();
  event.stopPropagation();
  activeFace.value = face;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuVisible.value = true;
}

/** 点击人脸跳转到人物详情;当前人物(人物详情页内)只关闭查看器 */
function handleFaceClick(face: Face) {
  if (!face.personId) {
    toast.info("该人脸尚未分配人物");
    return;
  }
  close();
  if (route.name === "person-detail" && route.params.id === face.personId) {
    return;
  }
  router.push({ name: "person-detail", params: { id: face.personId } });
}

function closeFaceContextMenu() {
  contextMenuVisible.value = false;
}

function openChangeBelongingDialog() {
  closeFaceContextMenu();
  resetPersons();
  reloadPersons();
  targetPersonId.value = "";
  showChangeBelongingDialog.value = true;
}

function openRenameDialog() {
  closeFaceContextMenu();
  renameName.value = activeFace.value?.personName ?? "";
  showRenameDialog.value = true;
}

async function submitChangeBelonging() {
  if (!activeFace.value || !targetPersonId.value) return;
  changingBelonging.value = true;
  try {
    await photoApi.face.changeFaceBelonging(
      activeFace.value.id,
      targetPersonId.value,
    );
    toast.success("人脸归属修改成功");
    showChangeBelongingDialog.value = false;
    await loadFaces();
    emit("faces-updated");
  } catch (error) {
    console.error("修改人脸归属失败:", error);
    toast.error("修改人脸归属失败");
  } finally {
    changingBelonging.value = false;
  }
}

async function submitRename() {
  const error = validation.validatePersonName(renameName.value);
  if (error) {
    toast.warning(error);
    return;
  }
  if (!activeFace.value?.personId) return;

  const name = renameName.value.trim();
  renaming.value = true;
  try {
    await photoApi.person.renamePerson(activeFace.value.personId, name);
    toast.success("人物名称修改成功");
    showRenameDialog.value = false;
    await loadFaces();
    emit("faces-updated");
  } catch (error) {
    console.error("修改人物名称失败:", error);
    toast.error("修改人物名称失败");
  } finally {
    renaming.value = false;
  }
}

/** 取消人脸归属（将人脸重新变为未分配） */
async function submitUnassign() {
  if (!activeFace.value?.personId) return;
  unassigning.value = true;
  try {
    await photoApi.face.changeFaceBelonging(activeFace.value.id, null);
    toast.success("已取消人脸归属");
    closeFaceContextMenu();
    await loadFaces();
    emit("faces-updated");
  } catch (error) {
    console.error("取消人脸归属失败:", error);
    toast.error("取消人脸归属失败");
  } finally {
    unassigning.value = false;
  }
}

/** 打开删除人脸确认弹窗 */
function openDeleteFaceConfirm() {
  closeFaceContextMenu();
  showDeleteFaceConfirm.value = true;
}

/** 删除人脸（仅未归属人物的人脸可删除） */
async function submitDeleteFace() {
  if (!activeFace.value) return;
  deletingFace.value = true;
  try {
    await photoApi.face.deleteFace(activeFace.value.id);
    toast.success("人脸已删除");
    showDeleteFaceConfirm.value = false;
    await loadFaces();
    emit("faces-updated");
  } catch (error) {
    console.error("删除人脸失败:", error);
    toast.error("删除人脸失败");
  } finally {
    deletingFace.value = false;
  }
}

// 点击其他区域关闭人脸右键菜单
watch(contextMenuVisible, (visible) => {
  if (visible) {
    window.addEventListener("click", closeFaceContextMenu);
  } else {
    window.removeEventListener("click", closeFaceContextMenu);
  }
});

// ---- 查看原图 ----
function viewOriginal() {
  if (!props.photo?.originalToken) return;

  // 如果已经显示原图，切换回预览图
  if (showOriginal.value) {
    triggerRefreshAnimation(() => {
      showOriginal.value = false;
    });
    return;
  }

  // 如果原图已缓存，直接切换
  if (originalUrl.value) {
    triggerRefreshAnimation(() => {
      showOriginal.value = true;
    });
    return;
  }

  // 否则加载原图
  loadingOriginal.value = true;
  const url = photoApi.getImgUrl(props.photo.originalToken);
  const img = new Image();
  img.onload = () => {
    originalUrl.value = url;
    loadingOriginal.value = false;
    triggerRefreshAnimation(() => {
      showOriginal.value = true;
    });
  };
  img.onerror = () => {
    loadingOriginal.value = false;
    console.error("原图加载失败");
  };
  img.src = url;
}

// ---- 触发刷新动画 ----
function triggerRefreshAnimation(callback: () => void) {
  refreshing.value = true;
  // 延迟切换，让动画开始
  setTimeout(() => {
    callback();
    // 动画结束后移除动画类
    setTimeout(() => {
      refreshing.value = false;
    }, 800);
  }, 50);
}

// ---- 下载原图 ----
async function downloadOriginal() {
  if (!props.photo) return;
  const token =
    props.photo.originalToken ||
    props.photo.previewToken ||
    props.photo.thumbnailToken;
  if (!token) return;

  try {
    const url = photoApi.getImgUrl(token);
    const loginResult = localStorage.getItem("MemorySeek.loginResult");
    const accessToken = localStorage.getItem("MemorySeek.accessToken");
    const headers: Record<string, string> = {};
    if (loginResult && accessToken) {
      const { user } = JSON.parse(loginResult);
      headers["Authorization"] = `Bearer ${user.id} ${accessToken}`;
    }
    const response = await fetch(url, { headers });
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = props.photo.name || "photo.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("下载失败:", error);
  }
}

// ---- 删除照片 ----
async function handleDelete() {
  if (!props.photo) return;
  deleting.value = true;
  try {
    await photoApi.deletePhotos([props.photo.id]);
    toast.success("照片已删除");
    emit("delete", props.photo.id);
    showDeleteConfirm.value = false;
    close();
  } catch (error) {
    console.error("删除照片失败:", error);
    toast.error("删除失败，请重试");
  } finally {
    deleting.value = false;
  }
}

// ---- 滚轮缩放 ----
function handleWheel(event: WheelEvent) {
  event.preventDefault();
  if (event.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

// ---- 键盘快捷键 ----
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable
  ) {
    return;
  }
  switch (event.key) {
    case "Escape":
      close();
      break;
    case "ArrowLeft":
      goPrev();
      break;
    case "ArrowRight":
      goNext();
      break;
    case "+":
    case "=":
      zoomIn();
      break;
    case "-":
      zoomOut();
      break;
    case "r":
    case "R":
      rotate();
      break;
    case "0":
      resetView();
      break;
    case "o":
    case "O":
      viewOriginal();
      break;
    case "d":
    case "D":
      downloadOriginal();
      break;
    case "b":
    case "B":
      toggleCollect();
      break;
    case "f":
    case "F":
      toggleFaces();
      break;
    case "l":
    case "L":
      toggleFavorite();
      break;
    case "c":
    case "C":
      toggleComments();
      break;
    case "t":
    case "T":
      toggleFaceLabels();
      break;
  }
}

// ---- 关闭弹窗 ----
function close() {
  emit("update:modelValue", false);
}

// ---- 点击背景关闭（只在点击空白区域时触发） ----
function handleContentClick(event: MouseEvent) {
  // 只有直接点击 content 元素本身时才关闭（不包括子元素）
  if (event.target === event.currentTarget) {
    close();
  }
}

// ---- 重置内部状态 ----
function resetState() {
  zoom.value = 1;
  baseZoom.value = 1;
  rotation.value = 0;
  translateX.value = 0;
  translateY.value = 0;
  imageWidth.value = 0;
  imageHeight.value = 0;
  showComments.value = false;
  showCollectionSelector.value = false;
  showOriginal.value = false;
  loadingOriginal.value = false;
  refreshing.value = false;
  originalUrl.value = null;
  showDeleteConfirm.value = false;
  deleting.value = false;
  isDragging.value = false;
  // 上一张/下一张状态
  loadingMore.value = false;
  hasMoreInViewer.value = true;
  // 人脸状态
  showFaces.value = props.initialShowFaces;
  faces.value = [];
  facesLoaded.value = false;
  loadingFaces.value = false;
  facesError.value = false;
  // 人脸操作状态
  contextMenuVisible.value = false;
  activeFace.value = null;
  showChangeBelongingDialog.value = false;
  showRenameDialog.value = false;
  showDeleteFaceConfirm.value = false;
  showFaceLabels.value = true;
  // 自动开启人脸框：加载该照片的人脸
  if (props.initialShowFaces && props.photo) {
    loadFaces();
  }
}

// 监听弹窗打开，添加键盘和拖拽事件
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeydown);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resetState();
    }
  },
);

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="photo-viewer"
      @click="handleContentClick"
      @keydown="handleKeydown"
      tabindex="0"
    >
      <!-- 加载提示（切换照片 / 触底加载下一页时隐藏当前照片并显示） -->
      <div v-if="imageLoading || loadingMore" class="photo-viewer__loading">
        <div class="photo-viewer__loading-spinner"></div>
      </div>

      <!-- 图片（加载期间用 CSS 隐藏，避免残留上一张照片；img 需保持渲染以触发加载） -->
      <div
        v-if="imageUrl && !loadingMore"
        class="photo-viewer__image-wrapper"
        :class="{
          'photo-viewer__image-wrapper--refreshing': refreshing,
          'photo-viewer__image-wrapper--hidden': imageLoading,
        }"
      >
        <img
          :key="showOriginal ? 'original' : 'preview'"
          :src="imageUrl"
          :alt="photo?.name"
          class="photo-viewer__image"
          :class="{
            'photo-viewer__image--dragging': isDragging,
            'photo-viewer__image--loaded': !imageLoading,
          }"
          :style="{
            transform: imageTransform,
            width: imageWidth ? imageWidth + 'px' : undefined,
            height: imageHeight ? imageHeight + 'px' : undefined,
          }"
          draggable="false"
          @load="handleImageLoad"
          @wheel.prevent="handleWheel"
          @mousedown="handleMouseDown"
          @touchstart="handleTouchStart"
          @touchmove.prevent="handleTouchMove"
          @touchend="handleTouchEnd"
        />

        <!-- 人脸框 overlay（与图片共用 transform，随缩放/旋转/拖拽同步） -->
        <div
          v-if="showFaces && faces.length > 0 && imageWidth > 0"
          class="photo-viewer__face-overlay"
          :style="{
            transform: imageTransform,
            width: imageWidth + 'px',
            height: imageHeight + 'px',
          }"
        >
          <div
            v-for="face in faces"
            :key="face.id"
            class="photo-viewer__face-box"
            :class="{
              'photo-viewer__face-box--active': activeFace?.id === face.id,
            }"
            :style="faceBoxStyle(face)"
            @click="handleFaceClick(face)"
            @contextmenu="handleFaceContextMenu($event, face)"
          >
            <span v-show="showFaceLabels" class="photo-viewer__face-label">{{
              face.personName || "未分配"
            }}</span>
          </div>
        </div>
      </div>
      <div
        v-else-if="!imageLoading && !loadingMore"
        class="photo-viewer__empty"
      >
        图片加载失败
      </div>

      <!-- 上一张/下一张 -->
      <button
        v-if="hasPrev"
        class="photo-viewer__nav photo-viewer__nav--prev"
        type="button"
        title="上一张 (←)"
        @click.stop="goPrev"
      >
        <ChevronLeft :size="32" />
      </button>
      <button
        v-if="showNext"
        class="photo-viewer__nav photo-viewer__nav--next"
        type="button"
        title="下一张 (→)"
        :disabled="loadingMore"
        @click.stop="goNext"
      >
        <LoadingIcon
          v-if="loadingMore"
          :size="28"
          class="photo-viewer__nav-loading"
        />
        <ChevronRight v-else :size="32" />
      </button>

      <!-- 底部工具栏 -->
      <PhotoToolbar
        v-show="!showComments"
        :zoom="zoom"
        :rotation="rotation"
        :is-favorited="isFavorited"
        :is-collected="isCollected"
        :show-original="showOriginal"
        :loading-original="loadingOriginal"
        :has-original-token="hasOriginalToken"
        :is-owner="isOwner"
        :show-faces="showFaces"
        :show-face-labels="showFaceLabels"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @rotate="rotate"
        @reset="resetView"
        @toggle-favorite="toggleFavorite"
        @toggle-collect="toggleCollect"
        @toggle-comments="toggleComments"
        @view-original="viewOriginal"
        @download="downloadOriginal"
        @delete="showDeleteConfirm = true"
        @toggle-faces="toggleFaces"
        @toggle-face-labels="toggleFaceLabels"
      />

      <!-- 侧边评论抽屉 -->
      <PhotoComments
        v-if="photo"
        :photo-id="photo.id"
        :visible="showComments"
        @close="showComments = false"
      />

      <!-- 收藏夹选择器 -->
      <CollectionSelector
        v-if="photo"
        v-model="showCollectionSelector"
        :photo-id="photo.id"
        overlay-class="photo-viewer__modal-overlay"
      />

      <!-- 人脸右键菜单 -->
      <div
        v-if="contextMenuVisible"
        class="photo-viewer__face-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop
      >
        <button
          type="button"
          class="photo-viewer__face-menu-item"
          @click="openChangeBelongingDialog"
        >
          修改归属
        </button>
        <button
          type="button"
          class="photo-viewer__face-menu-item"
          :disabled="!activeFace?.personId"
          @click="openRenameDialog"
        >
          重命名人物
        </button>
        <button
          type="button"
          class="photo-viewer__face-menu-item"
          :disabled="!activeFace?.personId"
          @click="submitUnassign"
        >
          {{ unassigning ? "取消中..." : "取消归属" }}
        </button>
        <button
          type="button"
          class="photo-viewer__face-menu-item photo-viewer__face-menu-item--danger"
          :disabled="!!activeFace?.personId"
          @click="openDeleteFaceConfirm"
        >
          删除人脸
        </button>
      </div>

      <!-- 修改人脸归属弹窗 -->
      <Modal
        v-model="showChangeBelongingDialog"
        size="sm"
        title="修改人脸归属"
        overlay-class="photo-viewer__modal-overlay"
      >
        <div class="face-dialog">
          <div class="face-dialog__field">
            <label class="face-dialog__label">当前人物</label>
            <Input :model-value="activeFace?.personName || '未分配'" disabled />
          </div>
          <div class="face-dialog__field">
            <label class="face-dialog__label">搜索目标人物</label>
            <Input v-model="personKeyword" placeholder="输入关键词筛选人物" />
            <p class="face-dialog__hint">支持姓名或首字母搜索</p>
          </div>
          <div class="face-dialog__list" @scroll="onPersonsScroll">
            <button
              v-for="person in persons"
              :key="person.id"
              type="button"
              class="face-dialog__person"
              :class="{
                'face-dialog__person--active': targetPersonId === person.id,
              }"
              @click="targetPersonId = person.id"
            >
              <span class="face-dialog__person-name">{{ person.name }}</span>
              <span class="face-dialog__person-count"
                >{{ Number(person.faceCount) }} 张照片</span
              >
            </button>
            <div v-if="personsLoading" class="face-dialog__empty">
              加载中...
            </div>
            <div
              v-else-if="personsLoaded && persons.length === 0"
              class="face-dialog__empty"
            >
              未找到人物
            </div>
            <div
              v-else-if="!personsHasMore && persons.length > 0"
              class="face-dialog__empty"
            >
              已经到底啦 ~
            </div>
          </div>
          <Button
            type="button"
            block
            :loading="changingBelonging"
            :disabled="!targetPersonId"
            @click="submitChangeBelonging"
          >
            确认修改
          </Button>
        </div>
      </Modal>

      <!-- 重命名人物弹窗 -->
      <Modal
        v-model="showRenameDialog"
        size="sm"
        title="重命名人物"
        overlay-class="photo-viewer__modal-overlay"
      >
        <div class="face-dialog">
          <div class="face-dialog__field">
            <label class="face-dialog__label">人物名称</label>
            <Input
              v-model="renameName"
              placeholder="输入新的人物名称"
              @keydown.enter="submitRename"
            />
          </div>
          <Button
            type="button"
            block
            :loading="renaming"
            :disabled="!renameName.trim()"
            @click="submitRename"
          >
            确认修改
          </Button>
        </div>
      </Modal>

      <!-- 删除确认弹窗 -->
      <Modal
        v-model="showDeleteConfirm"
        size="sm"
        title="删除照片"
        overlay-class="photo-viewer__modal-overlay"
      >
        <div class="delete-confirm">
          <p class="delete-confirm__text">
            确定要删除这张照片吗？此操作不可撤销。
          </p>
          <div class="delete-confirm__actions">
            <button
              class="delete-confirm__cancel"
              type="button"
              @click="showDeleteConfirm = false"
            >
              取消
            </button>
            <button
              class="delete-confirm__delete"
              type="button"
              :disabled="deleting"
              @click="handleDelete"
            >
              {{ deleting ? "删除中..." : "删除" }}
            </button>
          </div>
        </div>
      </Modal>

      <!-- 删除人脸确认弹窗 -->
      <Modal
        v-model="showDeleteFaceConfirm"
        size="sm"
        title="删除人脸"
        overlay-class="photo-viewer__modal-overlay"
      >
        <div class="delete-confirm">
          <p class="delete-confirm__text">
            确定要删除这张人脸吗？此操作不可撤销，且仅未归属人物的人脸可删除。
          </p>
          <div class="delete-confirm__actions">
            <button
              class="delete-confirm__cancel"
              type="button"
              @click="showDeleteFaceConfirm = false"
            >
              取消
            </button>
            <button
              class="delete-confirm__delete"
              type="button"
              :disabled="deletingFace"
              @click="submitDeleteFace"
            >
              {{ deletingFace ? "删除中..." : "删除" }}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  </Teleport>
</template>
