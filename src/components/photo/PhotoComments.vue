<!-- src/components/photo/PhotoComments.vue -->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { photo } from 'memory-seek-api'
import type { PhotoCommentResult } from 'memory-seek-api'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import './photo-comments.css'

dayjs.extend(relativeTime)

interface Props {
  photoId: string
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const userStore = useUserStore()

const comments = ref<PhotoCommentResult[]>([])
const loading = ref(false)
const sending = ref(false)
const newComment = ref('')
const listRef = ref<HTMLElement | null>(null)
const cursor = ref<string | undefined>(undefined)
const hasMore = ref(true)

/**
 * 获取用户头像 URL
 */
function getAvatarUrl(userId: string): string | null {
  const token = userStore.getAvatarToken(userId)
  return token ? photo.getImgUrl(token) : null
}

/**
 * 加载评论列表
 */
async function loadComments() {
  if (loading.value) return
  loading.value = true
  try {
    const response = await photo.comment.getCommentList(props.photoId, {
      cursor: cursor.value,
      size: 20,
    })
    const { records, nextCursor, hasMore: more } = response.data
    comments.value.push(...records)
    cursor.value = nextCursor ?? undefined
    hasMore.value = more

    // 获取评论用户信息
    const userIds = [...new Set(records.map((c) => c.userId))]
    await userStore.fetchUsers(userIds)
  } catch (error) {
    console.error('加载评论失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 发表评论
 */
async function handleSend() {
  const content = newComment.value.trim()
  if (!content || sending.value) return

  sending.value = true
  try {
    const response = await photo.comment.publishComment(props.photoId, content)
    comments.value.unshift(response.data)
    newComment.value = ''
    // 滚动到顶部查看新评论
    await nextTick()
    if (listRef.value) {
      listRef.value.scrollTop = 0
    }
  } catch (error) {
    console.error('发表评论失败:', error)
  } finally {
    sending.value = false
  }
}

/**
 * 切换评论点赞
 */
async function handleToggleLike(comment: PhotoCommentResult) {
  try {
    if (comment.isLiked) {
      await photo.comment.unlikeComment(props.photoId, comment.id)
      comment.isLiked = false
      comment.likeCount--
    } else {
      await photo.comment.likeComment(props.photoId, comment.id)
      comment.isLiked = true
      comment.likeCount++
    }
  } catch (error) {
    console.error('评论点赞失败:', error)
  }
}

/**
 * 是否是自己的评论
 */
function isOwnComment(comment: PhotoCommentResult): boolean {
  return comment.userId === authStore.userId
}

/**
 * 删除评论
 */
async function handleDeleteComment(comment: PhotoCommentResult) {
  try {
    await photo.comment.deleteComment(props.photoId, comment.id)
    comments.value = comments.value.filter((c) => c.id !== comment.id)
  } catch (error) {
    console.error('删除评论失败:', error)
  }
}

/**
 * 格式化时间
 */
function formatTime(time: string): string {
  return dayjs(time).locale('zh-cn').fromNow()
}

/**
 * 键盘发送（Ctrl+Enter / Cmd+Enter）
 */
function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    handleSend()
  }
}

// 监听 visible 变化，打开时加载评论
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible && comments.value.length === 0) {
      loadComments()
    }
  },
)

// 监听 photoId 变化，重置状态
watch(
  () => props.photoId,
  () => {
    comments.value = []
    cursor.value = undefined
    hasMore.value = true
    newComment.value = ''
    if (props.visible) {
      loadComments()
    }
  },
)
</script>

<template>
  <div class="photo-comments" :class="{ 'photo-comments--visible': visible }">
    <!-- 头部 -->
    <div class="photo-comments__header">
      <h3 class="photo-comments__title">评论</h3>
      <button class="photo-comments__close" type="button" @click="emit('close')">
        <X :size="18" />
      </button>
    </div>

    <!-- 评论列表 -->
    <div ref="listRef" class="photo-comments__list">
      <div v-if="loading && comments.length === 0" class="photo-comments__loading">
        加载中...
      </div>
      <div v-else-if="comments.length === 0" class="photo-comments__empty">
        暂无评论
      </div>
      <template v-else>
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="comment-item"
        >
          <div class="comment-item__header">
            <div class="comment-item__user-info">
              <img
                v-if="getAvatarUrl(comment.userId)"
                :src="getAvatarUrl(comment.userId)!"
                :alt="userStore.getNickname(comment.userId)"
                class="comment-item__avatar"
              />
              <div v-else class="comment-item__avatar comment-item__avatar--placeholder">
                {{ userStore.getNickname(comment.userId).charAt(0) }}
              </div>
              <span class="comment-item__user">{{ userStore.getNickname(comment.userId) }}</span>
            </div>
            <span class="comment-item__time">{{ formatTime(comment.createdAt) }}</span>
          </div>
          <p class="comment-item__content">{{ comment.content }}</p>
          <div class="comment-item__footer">
            <button
              class="comment-item__like"
              :class="{ 'comment-item__like--active': comment.isLiked }"
              type="button"
              @click="handleToggleLike(comment)"
            >
              <Heart :size="14" :fill="comment.isLiked ? 'var(--color-like)' : 'none'" />
              <span v-if="comment.likeCount > 0">{{ comment.likeCount }}</span>
            </button>
            <button
              v-if="isOwnComment(comment)"
              class="comment-item__delete"
              type="button"
              @click="handleDeleteComment(comment)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </template>

      <!-- 加载更多 -->
      <button
        v-if="hasMore && !loading && comments.length > 0"
        class="photo-comments__more"
        type="button"
        @click="loadComments"
      >
        加载更多
      </button>
      <div v-if="loading && comments.length > 0" class="photo-comments__loading">
        加载中...
      </div>
    </div>

    <!-- 发送评论 -->
    <div class="photo-comments__input-area">
      <textarea
        v-model="newComment"
        class="photo-comments__input"
        placeholder="写评论..."
        rows="1"
        @keydown="handleKeydown"
      />
      <button
        class="photo-comments__send"
        type="button"
        :disabled="!newComment.trim() || sending"
        @click="handleSend"
      >
        <Send :size="16" />
      </button>
    </div>
  </div>
</template>
