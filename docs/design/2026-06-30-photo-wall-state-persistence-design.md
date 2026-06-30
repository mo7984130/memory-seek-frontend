# 照片墙状态保持设计

## 问题描述

用户在照片墙页面浏览照片后，切换到其他页面（如收藏夹、个人中心），再切换回来时，照片墙会重新加载，丢失已浏览的照片列表、滚动位置和时间线状态。

## 设计目标

保持以下状态：
- 已加载的照片列表
- 当前滚动位置
- 时间线导航状态（当前选中的月份）
- 搜索/筛选条件（未来扩展）

## 方案选择

### 选项

1. **Pinia Store 持久化** ✅ 选中
2. KeepAlive 缓存组件
3. Pinia Store + KeepAlive 混合

### 选择理由

1. 照片数据本身就是全局状态，放 Store 更合理
2. KeepAlive 对内存敏感的 SPA（大量图片）可能造成内存压力
3. 滚动位置用 `sessionStorage` 存储，刷新后清除（符合预期）

## 详细设计

### 1. Store 结构

```ts
// stores/photo.ts
import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import type { PhotoResult, MonthStat } from 'memory-seek-api'

export const usePhotoStore = defineStore('photo', () => {
  // ======== 状态 ========
  
  // 照片列表数据
  const allPhotos = ref<PhotoResult[]>([])
  const cursor = ref<string | undefined>(undefined)
  const hasMore = ref(true)
  
  // 时间线状态
  const monthStats = ref<MonthStat[]>([])
  const currentGroup = ref('')
  
  // 滚动位置（内存中，同时备份到 sessionStorage）
  const scrollTop = ref(0)
  
  // ======== Actions ========
  
  /**
   * 追加照片列表
   */
  function appendPhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value.push(...photos)
    cursor.value = nextCursor
    hasMore.value = more
  }
  
  /**
   * 替换照片列表（用于时间线跳转）
   */
  function replacePhotos(photos: PhotoResult[], nextCursor?: string, more: boolean = true) {
    allPhotos.value = photos
    cursor.value = nextCursor
    hasMore.value = more
  }
  
  /**
   * 更新照片点赞状态
   */
  function updatePhotoLike(photoId: string, isLiked: boolean) {
    const target = allPhotos.value.find(p => p.id === photoId)
    if (target) {
      target.isLiked = isLiked
    }
  }
  
  /**
   * 删除照片
   */
  function removePhoto(photoId: string) {
    allPhotos.value = allPhotos.value.filter(p => p.id !== photoId)
  }
  
  /**
   * 保存滚动位置
   */
  function saveScrollPosition() {
    scrollTop.value = window.scrollY
    sessionStorage.setItem('photo-scroll', String(window.scrollY))
  }
  
  /**
   * 恢复滚动位置
   */
  function restoreScrollPosition() {
    const saved = sessionStorage.getItem('photo-scroll')
    if (saved) {
      nextTick(() => {
        window.scrollTo(0, parseInt(saved))
      })
    }
  }
  
  /**
   * 重置状态（用于用户主动刷新）
   */
  function resetState() {
    allPhotos.value = []
    cursor.value = undefined
    hasMore.value = true
    monthStats.value = []
    currentGroup.value = ''
    scrollTop.value = 0
    sessionStorage.removeItem('photo-scroll')
  }
  
  return {
    // 状态
    allPhotos,
    cursor,
    hasMore,
    monthStats,
    currentGroup,
    scrollTop,
    
    // Actions
    appendPhotos,
    replacePhotos,
    updatePhotoLike,
    removePhoto,
    saveScrollPosition,
    restoreScrollPosition,
    resetState,
  }
})
```

### 2. 组件改造

#### PhotoWaterfallView.vue

```vue
<script setup lang="ts">
import { usePhotoStore } from '@/stores/photo'

const photoStore = usePhotoStore()

// 从 Store 读取状态（替代本地 ref）
const allPhotos = computed(() => photoStore.allPhotos)
const cursor = computed(() => photoStore.cursor)
const hasMore = computed(() => photoStore.hasMore)
const monthStats = computed(() => photoStore.monthStats)
const currentGroup = computed(() => photoStore.currentGroup)

// 照片查看器状态（保持本地，因为是临时 UI 状态）
const viewerVisible = ref(false)
const selectedPhoto = ref<PhotoResult | null>(null)

/**
 * 获取照片列表
 */
async function fetchPhotos() {
  if (loading.value || !photoStore.hasMore) return
  
  const gen = fetchGeneration
  loading.value = true
  try {
    const response = await photo.getPhotos({
      cursor: photoStore.cursor,
      size: 20,
      direction: 'next',
    })
    
    if (gen !== fetchGeneration) return
    
    const { records, nextCursor, hasMore: more } = response.data
    photoStore.appendPhotos(records, nextCursor ?? undefined, more)
  } catch (error) {
    console.error('获取照片失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 时间线导航跳转
 */
async function handleNavigate(groupKey: string) {
  if (navigating.value) return
  navigating.value = true
  fetchGeneration++
  
  try {
    const [yearStr, monthStr] = groupKey.split('-')
    const anchorTime = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr), 1)).toISOString()
    
    loading.value = true
    const response = await photo.getPhotos({
      size: 20,
      direction: 'next',
      anchorTime,
    })
    const { records, nextCursor, hasMore: more } = response.data
    
    // 使用 Store 的 replacePhotos
    photoStore.replacePhotos(records, nextCursor ?? undefined, more)
    photoStore.currentGroup = groupKey
    
    await nextTick()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    console.error('导航失败:', error)
  } finally {
    loading.value = false
    navigating.value = false
  }
}

/**
 * 点赞处理
 */
async function handleLike(photoItem: PhotoResult) {
  const photoId = photoItem.id as string
  const wasLiked = photoItem.isLiked ?? false
  
  // 乐观更新 Store
  photoStore.updatePhotoLike(photoId, !wasLiked)
  
  try {
    if (wasLiked) {
      await photo.like.unlikePhoto(photoId)
    } else {
      await photo.like.likePhoto(photoId)
    }
  } catch (error) {
    // 回滚
    photoStore.updatePhotoLike(photoId, wasLiked)
    console.error('点赞操作失败:', error)
  }
}

/**
 * 删除处理
 */
function handleDelete(photoId: string) {
  photoStore.removePhoto(photoId)
}

onMounted(async () => {
  handleResize()
  window.addEventListener('resize', handleResize)
  
  // 如果 Store 有数据，跳过加载，恢复滚动位置
  if (photoStore.allPhotos.length > 0) {
    photoStore.restoreScrollPosition()
    return
  }
  
  // 首次加载
  const [statsRes] = await Promise.all([
    photo.timeline.getMonthlyStats(),
    fetchPhotos(),
  ])
  
  photoStore.monthStats = statsRes.data
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  photoStore.saveScrollPosition()  // 保存滚动位置
})
</script>
```

### 3. 边界情况处理

#### 用户主动刷新
- 路由守卫检测到同一页面刷新，不清除 Store
- `sessionStorage` 的滚动位置会丢（符合预期：刷新回到顶部）
- Store 数据在内存中，刷新后丢失（符合预期：刷新加载新数据）

#### 时间线导航跳转
- 跳转时清空 `allPhotos`，重置 `cursor`
- 更新 `currentGroup`

#### 点赞/删除操作
- 同步更新 Store 中的数据
- 保证切换回来后状态一致

### 4. 状态存储位置

| 状态 | 存储位置 | 生命周期 |
|------|----------|----------|
| 照片列表 | Pinia Store (内存) | 组件销毁后保持 |
| 滚动位置 | sessionStorage | 页面刷新后清除 |
| 时间线状态 | Pinia Store | 组件销毁后保持 |
| 筛选条件 | Pinia Store | 组件销毁后保持 |

## 实现步骤

1. 创建 `stores/photo.ts` Store
2. 修改 `PhotoWaterfallView.vue`，从 Store 读取状态
3. 添加滚动位置保存/恢复逻辑
4. 测试边界情况

## 验证标准

- [ ] 照片墙 → 其他页面 → 照片墙，照片列表保持
- [ ] 照片墙 → 其他页面 → 照片墙，滚动位置保持
- [ ] 照片墙 → 其他页面 → 照片墙，时间线状态保持
- [ ] 刷新页面，照片重新加载（符合预期）
- [ ] 点赞/删除后切换页面再回来，状态一致
