<script setup lang="ts">
import { ref } from "vue";
import type { Photo } from "memory-seek-api";
import VirtualWaterfall, {
  type WaterfallGroup,
  type WaterfallItem,
} from "./VirtualWaterfall.vue";
import PhotoCard from "./PhotoCard.vue";

/**
 * 照片瀑布流封装：通用 VirtualWaterfall + PhotoCard + 宽高比高度。
 * 照片页面只需面向本组件，卡片渲染、分组、触底加载与首屏填充均已内置。
 */

const props = withDefaults(
  defineProps<{
    groups?: WaterfallGroup[];
    photos: Photo[];
    columnCount: number;
    containerWidth: number;
    gap?: number;
    buffer?: number;
    hasMore?: boolean;
    loading?: boolean;
    loadMore?: () => Promise<number | void>;
    emptyText?: string;
  }>(),
  {
    gap: 16,
    buffer: 800,
    hasMore: false,
    loading: false,
  },
);

const emit = defineEmits<{
  (e: "top-item-change", item: WaterfallItem): void;
  (e: "current-group-change", key: string): void;
  (e: "photo-click", photo: Photo): void;
  (e: "like", photo: Photo): void;
}>();

const waterfallRef = ref<InstanceType<typeof VirtualWaterfall> | null>(null);

function getPhotoById(id: string | number): Photo | undefined {
  return props.photos.find((p) => p.id === id);
}

function scrollToGroup(groupKey: string) {
  waterfallRef.value?.scrollToGroup(groupKey);
}

function scrollToItem(id: string | number, behavior?: ScrollBehavior) {
  waterfallRef.value?.scrollToItem(id, behavior);
}

defineExpose({ scrollToGroup, scrollToItem });
</script>

<template>
  <VirtualWaterfall
    ref="waterfallRef"
    :groups="groups"
    :column-count="columnCount"
    :container-width="containerWidth"
    :gap="gap"
    :buffer="buffer"
    :has-more="hasMore"
    :loading="loading"
    :load-more="loadMore"
    :empty-text="emptyText"
    @top-item-change="emit('top-item-change', $event)"
    @current-group-change="emit('current-group-change', $event)"
  >
    <template #default="{ item }">
      <PhotoCard
        v-if="getPhotoById(item.id)"
        :item="getPhotoById(item.id)!"
        @click="emit('photo-click', $event)"
        @like="emit('like', $event)"
      />
    </template>
  </VirtualWaterfall>
</template>
