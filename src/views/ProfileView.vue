<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Camera, LogOut, Key, Edit3, Copy, Check, Ticket } from '@/components/base/Icon/icons'
import { user, photo } from 'memory-seek-api'
import type { UserInfo, InviterCodeResult } from 'memory-seek-api'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/data/Card/Card.vue'
import Modal from '@/components/feedback/Modal/Modal.vue'
import Input from '@/components/form/Input/Input.vue'
import Spinner from '@/components/base/Spinner/Spinner.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const INVITER_CODE_KEY = 'inviter_code'

const authStore = useAuthStore()
const toast = useToast()

const loading = ref(true)
const userInfo = ref<UserInfo | null>(null)

// 邀请码
const inviterCode = ref<InviterCodeResult | null>(null)
const generatingCode = ref(false)
const copied = ref(false)

// 编辑昵称
const showNicknameModal = ref(false)
const newNickname = ref('')
const savingNickname = ref(false)

// 修改密码
const showPasswordModal = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)

// 退出登录确认
const showLogoutConfirm = ref(false)

const avatarUrl = computed(() => {
  const token = userInfo.value?.avatarToken
  return token ? photo.getImgUrl(token) : null
})

const avatarText = computed(() => {
  const name = userInfo.value?.nickname ?? userInfo.value?.username ?? 'U'
  return name.charAt(0).toUpperCase()
})

/**
 * 加载用户信息
 */
async function loadData() {
  loading.value = true
  try {
    const userRes = await user.getMe()
    userInfo.value = userRes.data
    // 从 localStorage 恢复邀请码
    loadSavedInviterCode()
  } catch (error) {
    console.error('加载用户信息失败:', error)
  } finally {
    loading.value = false
  }
}

/**
 * 从 localStorage 恢复邀请码
 */
function loadSavedInviterCode() {
  try {
    const saved = localStorage.getItem(INVITER_CODE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as InviterCodeResult
      // 检查是否过期
      if (new Date(parsed.expireAt).getTime() > Date.now()) {
        inviterCode.value = parsed
      } else {
        localStorage.removeItem(INVITER_CODE_KEY)
      }
    }
  } catch {
    localStorage.removeItem(INVITER_CODE_KEY)
  }
}

/**
 * 生成邀请码
 */
async function handleGenerateCode() {
  generatingCode.value = true
  try {
    const res = await user.generateInviterCode()
    inviterCode.value = res.data
    localStorage.setItem(INVITER_CODE_KEY, JSON.stringify(res.data))
    toast.success('邀请码生成成功')
  } catch (error) {
    console.error('生成邀请码失败:', error)
  } finally {
    generatingCode.value = false
  }
}

/**
 * 复制邀请码
 */
async function copyInviterCode() {
  if (!inviterCode.value) return
  try {
    await navigator.clipboard.writeText(inviterCode.value.inviterCode)
    copied.value = true
    toast.success('已复制到剪贴板')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

/**
 * 格式化过期时间
 */
function formatExpireAt(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  const datePart = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  let remain = ''
  if (hours > 24) {
    remain = `（剩余 ${Math.floor(hours / 24)} 天）`
  } else if (hours > 0) {
    remain = `（剩余 ${hours} 小时 ${minutes} 分钟）`
  } else if (minutes > 0) {
    remain = `（剩余 ${minutes} 分钟）`
  } else {
    remain = '（即将过期）'
  }

  return `${datePart} ${timePart} ${remain}`
}

/**
 * 上传头像
 */
async function handleAvatarUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const res = await user.uploadAvatar(file)
    if (userInfo.value) {
      userInfo.value.avatarToken = res.data
    }
    toast.success('头像更新成功')
  } catch (error) {
    console.error('上传头像失败:', error)
  }

  // 重置 input
  input.value = ''
}

/**
 * 打开编辑昵称弹窗
 */
function openNicknameEdit() {
  newNickname.value = userInfo.value?.nickname ?? ''
  showNicknameModal.value = true
}

/**
 * 保存昵称
 */
async function handleSaveNickname() {
  const nickname = newNickname.value.trim()
  if (!nickname) {
    toast.warning('请输入昵称')
    return
  }

  savingNickname.value = true
  try {
    await user.changeNickname({ newNickname: nickname })
    if (userInfo.value) {
      userInfo.value.nickname = nickname
    }
    showNicknameModal.value = false
    toast.success('昵称更新成功')
  } catch (error) {
    console.error('修改昵称失败:', error)
  } finally {
    savingNickname.value = false
  }
}

/**
 * 打开修改密码弹窗
 */
function openPasswordChange() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordModal.value = true
}

/**
 * 保存密码
 */
async function handleSavePassword() {
  if (!oldPassword.value) {
    toast.warning('请输入当前密码')
    return
  }
  if (!newPassword.value) {
    toast.warning('请输入新密码')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.warning('两次输入的密码不一致')
    return
  }
  if (newPassword.value.length < 6) {
    toast.warning('密码长度不能少于 6 位')
    return
  }

  savingPassword.value = true
  try {
    await user.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    showPasswordModal.value = false
    toast.success('密码修改成功')
  } catch (error) {
    console.error('修改密码失败:', error)
  } finally {
    savingPassword.value = false
  }
}

/**
 * 退出登录
 */
function handleLogout() {
  authStore.logout()
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="profile-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="profile-view__loading">
      <Spinner size="lg" />
    </div>

    <template v-else-if="userInfo">
      <!-- 用户信息卡片 -->
      <Card class="profile-card" shadow="sm" padding="lg">
        <div class="profile-card__content">
          <!-- 头像 -->
          <div class="profile-card__avatar-wrapper">
            <div class="profile-card__avatar">
              <img v-if="avatarUrl" :src="avatarUrl" class="profile-card__avatar-img" alt="" />
              <span v-else>{{ avatarText }}</span>
            </div>
            <label class="profile-card__avatar-upload" title="更换头像">
              <Camera :size="14" />
              <input
                type="file"
                accept="image/*"
                class="profile-card__avatar-input"
                @change="handleAvatarUpload"
              />
            </label>
          </div>

          <!-- 用户信息 -->
          <div class="profile-card__info">
            <div class="profile-card__name-row">
              <span class="profile-card__nickname">{{ userInfo.nickname || userInfo.username }}</span>
              <button class="profile-card__edit-btn" type="button" @click="openNicknameEdit" title="编辑昵称">
                <Edit3 :size="14" />
              </button>
            </div>
            <div class="profile-card__username">@{{ userInfo.username }}</div>
            <div class="profile-card__email" v-if="userInfo.email">{{ userInfo.email }}</div>
            <div class="profile-card__join-date">
              注册于 {{ formatDate(userInfo.createdAt) }}
            </div>
          </div>
        </div>
      </Card>

      <!-- 邀请码 -->
      <div class="invite-section">
        <h3 class="section-title">邀请码</h3>
        <Card shadow="sm" padding="sm" class="invite-card">
          <div v-if="inviterCode" class="invite-card__row">
            <code class="invite-card__code">{{ inviterCode.inviterCode }}</code>
            <button
              class="invite-card__copy"
              type="button"
              @click="copyInviterCode"
              title="复制"
            >
              <Check v-if="copied" :size="16" />
              <Copy v-else :size="16" />
            </button>
            <span class="invite-card__expire">
              {{ formatExpireAt(inviterCode.expireAt) }}
            </span>
            <button
              class="invite-card__regenerate"
              type="button"
              :disabled="generatingCode"
              @click="handleGenerateCode"
              title="重新生成"
            >
              <Ticket :size="14" />
            </button>
          </div>
          <div v-else class="invite-card__row invite-card__row--empty">
            <span class="invite-card__placeholder">暂无邀请码</span>
            <button
              class="invite-card__generate"
              type="button"
              :disabled="generatingCode"
              @click="handleGenerateCode"
              title="生成邀请码"
            >
              <Ticket :size="14" />
              {{ generatingCode ? '生成中...' : '生成' }}
            </button>
          </div>
        </Card>
      </div>

      <!-- 账号安全 -->
      <div class="security-section">
        <h3 class="section-title">账号安全</h3>
        <div class="security-actions">
          <Card shadow="sm" padding="none" hoverable class="security-card" @click="openPasswordChange">
            <div class="security-btn">
              <Key :size="18" />
              <span>修改密码</span>
            </div>
          </Card>
          <Card shadow="sm" padding="none" hoverable class="security-card security-card--danger" @click="showLogoutConfirm = true">
            <div class="security-btn security-btn--danger">
              <LogOut :size="18" />
              <span>退出登录</span>
            </div>
          </Card>
        </div>
      </div>
    </template>

    <!-- 编辑昵称弹窗 -->
    <Modal v-model="showNicknameModal" size="sm" title="修改昵称">
      <div class="modal-form">
        <div class="modal-form__field">
          <label class="modal-form__label">新昵称</label>
          <Input
            v-model="newNickname"
            placeholder="输入新昵称"
            @keydown.enter="handleSaveNickname"
          />
        </div>
        <button class="modal-form__submit" type="button" :disabled="savingNickname" @click="handleSaveNickname">
          {{ savingNickname ? '保存中...' : '保存' }}
        </button>
      </div>
    </Modal>

    <!-- 修改密码弹窗 -->
    <Modal v-model="showPasswordModal" size="sm" title="修改密码">
      <div class="modal-form">
        <div class="modal-form__field">
          <label class="modal-form__label">当前密码</label>
          <Input
            v-model="oldPassword"
            type="password"
            placeholder="输入当前密码"
          />
        </div>
        <div class="modal-form__field">
          <label class="modal-form__label">新密码</label>
          <Input
            v-model="newPassword"
            type="password"
            placeholder="输入新密码（至少 6 位）"
          />
        </div>
        <div class="modal-form__field">
          <label class="modal-form__label">确认新密码</label>
          <Input
            v-model="confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            @keydown.enter="handleSavePassword"
          />
        </div>
        <button class="modal-form__submit" type="button" :disabled="savingPassword" @click="handleSavePassword">
          {{ savingPassword ? '修改中...' : '修改密码' }}
        </button>
      </div>
    </Modal>

    <!-- 退出登录确认 -->
    <Modal v-model="showLogoutConfirm" size="sm" title="退出登录">
      <div class="logout-confirm">
        <p class="logout-confirm__text">确定要退出登录吗？</p>
        <div class="logout-confirm__actions">
          <button class="logout-confirm__cancel" type="button" @click="showLogoutConfirm = false">
            取消
          </button>
          <button class="logout-confirm__logout" type="button" @click="handleLogout">
            退出登录
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.profile-view {
  padding: var(--spacing-6) var(--spacing-4);
  min-height: 100vh;
  max-width: 640px;
  margin: 0 auto;
}

.profile-view__loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-16) 0;
}

/* 用户信息卡片 */
.profile-card {
  margin-bottom: var(--spacing-6);
}

.profile-card__content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-5);
}

.profile-card__avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.profile-card__avatar {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.profile-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-card__avatar-upload {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: var(--transition-fast-out);
}

.profile-card__avatar-upload:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.profile-card__avatar-input {
  display: none;
}

.profile-card__info {
  flex: 1;
  min-width: 0;
}

.profile-card__name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.profile-card__nickname {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.profile-card__edit-btn {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--spacing-1);
  border-radius: var(--radius-sm);
  transition: var(--transition-fast-out);
}

.profile-card__edit-btn:hover {
  color: var(--color-primary);
  background: var(--color-bg-hover);
}

.profile-card__username {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-1);
}

.profile-card__email {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-1);
}

.profile-card__join-date {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-2);
}

/* 通用标题 */
.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4);
  padding-left: var(--spacing-3);
  border-left: 4px solid var(--color-primary);
}

/* 邀请码 */
.invite-section {
  margin-bottom: var(--spacing-6);
}

.invite-card {
  /* Card 组件已处理基础样式 */
}

.invite-card__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 0;
}

.invite-card__code {
  flex-shrink: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
  color: var(--color-primary);
  letter-spacing: 0.05em;
}

.invite-card__copy {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast-out);
}

.invite-card__copy:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.invite-card__expire {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  text-align: right;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-card__regenerate {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast-out);
}

.invite-card__regenerate:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.invite-card__regenerate:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.invite-card__row--empty {
  justify-content: space-between;
}

.invite-card__placeholder {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.invite-card__generate {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-3);
  background: transparent;
  border: 1px solid var(--color-primary);
  border-radius: var(--btn-radius);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-primary);
  cursor: pointer;
  font-family: inherit;
  transition: var(--btn-transition);
}

.invite-card__generate:hover {
  background: var(--color-primary);
  color: white;
}

.invite-card__generate:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

/* 账号安全 */
.security-section {
  margin-bottom: var(--spacing-6);
}

.security-actions {
  display: flex;
  flex-direction: row;
  gap: var(--spacing-3);
}

.security-card {
  flex: 1;
}

.security-card--danger:hover {
  border-color: var(--color-danger);
}

.security-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: inherit;
}

.security-btn--danger {
  color: var(--color-danger);
}

/* 弹窗表单 */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.modal-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.modal-form__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.modal-form__submit {
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

.modal-form__submit:hover {
  background: var(--color-primary-dark);
}

.modal-form__submit:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

/* 退出确认 */
.logout-confirm__text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-6);
}

.logout-confirm__actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
}

.logout-confirm__cancel {
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

.logout-confirm__cancel:hover {
  border-color: var(--color-text-tertiary);
}

.logout-confirm__logout {
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

.logout-confirm__logout:hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .profile-view {
    padding: var(--spacing-4) var(--spacing-2);
  }

  .profile-card__content {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-card__name-row {
    justify-content: center;
  }
}
</style>
