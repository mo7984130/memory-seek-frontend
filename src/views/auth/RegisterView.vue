<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Mail, ArrowRight, Shield, Sun, Moon } from '@/components/base/Icon/icons'
import { auth } from 'memory-seek-api'
import { useThemeStore } from '@/stores/theme'
import Input from '@/components/form/Input/Input.vue'
import Button from '@/components/actions/Button/Button.vue'
import IconButton from '@/components/actions/IconButton/IconButton.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const router = useRouter()
const themeStore = useThemeStore()
const toast = useToast()

// 表单状态
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const inviterCode = ref('')
const emailCode = ref('')
const loading = ref(false)
const codeSending = ref(false)
const countdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

// 计算属性
const isCountingDown = computed(() => countdown.value > 0)
const countdownText = computed(() => `${countdown.value}s`)

/**
 * 清理定时器
 */
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

/**
 * 开始倒计时
 */
function startCountdown() {
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }, 1000)
}

/**
 * 发送邮箱验证码
 */
async function handleSendCode() {
  if (!email.value.trim()) {
    toast.warning('请输入邮箱')
    return
  }

  // 简单邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    toast.warning('请输入正确的邮箱格式')
    return
  }

  codeSending.value = true
  try {
    await auth.sendEmailCode({ email: email.value })
    toast.success('验证码已发送')
    startCountdown()
  } catch (error) {
    toast.error('发送验证码失败: ' + error)
  } finally {
    codeSending.value = false
  }
}

/**
 * 表单验证
 */
function validateForm(): boolean {
  if (!username.value.trim()) {
    toast.warning('请输入用户名')
    return false
  }

  if (username.value.length < 3 || username.value.length > 20) {
    toast.warning('用户名长度应为 3-20 个字符')
    return false
  }

  if (!email.value.trim()) {
    toast.warning('请输入邮箱')
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    toast.warning('请输入正确的邮箱格式')
    return false
  }

  if (!password.value) {
    toast.warning('请输入密码')
    return false
  }

  if (password.value.length < 6) {
    toast.warning('密码长度不能少于 6 位')
    return false
  }

  if (password.value !== confirmPassword.value) {
    toast.warning('两次输入的密码不一致')
    return false
  }

  if (!nickname.value.trim()) {
    toast.warning('请输入昵称')
    return false
  }

  if (!emailCode.value.trim()) {
    toast.warning('请输入邮箱验证码')
    return false
  }

  if (!inviterCode.value.trim()) {
    toast.warning('请输入邀请码')
    return false
  }

  return true
}

/**
 * 注册处理
 */
async function handleRegister() {
  if (!validateForm()) return

  loading.value = true
  try {
    const response = await auth.register({
      username: username.value,
      email: email.value,
      password: password.value,
      nickname: nickname.value,
      inviterCode: inviterCode.value,
      emailVerifyCode: emailCode.value,
    })

    if (response.code === 200) {
      toast.success('注册成功，请登录')
      await router.push('/login')
    }
  } catch (error) {
    toast.error('注册失败: ' + error)
  } finally {
    loading.value = false
  }
}

/**
 * 跳转到登录页
 */
function handleLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="register-view">
    <!-- 主题切换按钮 -->
    <IconButton class="auth-theme-btn" @click="themeStore.toggleTheme()">
      <Moon v-if="!themeStore.isDark" :size="20" />
      <Sun v-else :size="20" />
    </IconButton>

    <div class="register-container">
      <!-- 品牌区域 -->
      <div class="register-brand">
        <h1 class="register-brand__title">寻忆</h1>
        <p class="register-brand__subtitle">让时光驻留，让记忆重现。</p>
      </div>

      <!-- 注册表单 -->
      <form class="register-form" @submit.prevent="handleRegister">
        <!-- 用户名输入框 -->
        <div class="register-form__field">
          <Input v-model="username" placeholder="用户名" size="lg">
            <template #prefix>
              <User :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 昵称输入框 -->
        <div class="register-form__field">
          <Input v-model="nickname" placeholder="昵称" size="lg">
            <template #prefix>
              <User :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 邮箱输入框 -->
        <div class="register-form__field">
          <Input v-model="email" type="email" placeholder="邮箱" size="lg">
            <template #prefix>
              <Mail :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 邮箱验证码 -->
        <div class="register-form__field">
          <Input v-model="emailCode" placeholder="邮箱验证码" size="lg">
            <template #prefix>
              <Shield :size="18" class="register-form__icon" />
            </template>
            <template #suffix>
              <button
                type="button"
                class="register-form__code-btn"
                :disabled="codeSending || isCountingDown"
                @click="handleSendCode"
              >
                <span v-if="codeSending" class="register-form__code-loading">···</span>
                <span v-else>{{ isCountingDown ? countdownText : '获取' }}</span>
              </button>
            </template>
          </Input>
        </div>

        <!-- 密码输入框 -->
        <div class="register-form__field">
          <Input v-model="password" type="password" placeholder="密码（至少 6 位）" size="lg">
            <template #prefix>
              <Lock :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 确认密码输入框 -->
        <div class="register-form__field">
          <Input v-model="confirmPassword" type="password" placeholder="确认密码" size="lg">
            <template #prefix>
              <Lock :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 邀请码 -->
        <div class="register-form__field">
          <Input v-model="inviterCode" placeholder="邀请码" size="lg">
            <template #prefix>
              <Shield :size="18" class="register-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 注册按钮 -->
        <Button type="submit" size="lg" block :loading="loading" class="register-form__submit">
          注册
          <ArrowRight :size="18" />
        </Button>
      </form>

      <!-- 登录链接 -->
      <div class="register-form__footer">
        <span class="register-form__footer-text">已有账号？</span>
        <span class="register-form__footer-link" @click="handleLogin"> 立即登录 </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-view {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-bg-primary), var(--color-bg-secondary));
  padding: var(--spacing-4);
  position: relative;
}

.auth-theme-btn {
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  z-index: 10;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast-out);
}

@media (hover: hover) and (pointer: fine) {
  .auth-theme-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
}

.register-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-8);
  width: 100%;
  max-width: 400px;
}

.register-brand {
  text-align: center;
}

.register-brand__title {
  font-size: var(--text-4xl);
  font-weight: var(--font-light);
  letter-spacing: 0.5em;
  color: var(--color-text-primary);
  font-family: var(--font-serif);
  margin: 0;
}

.register-brand__subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-4);
  letter-spacing: var(--tracking-wider);
}

.register-form {
  width: 400px;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-xl);
  padding: var(--spacing-8);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.dark .register-form {
  background: rgba(45, 45, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.register-form__field {
  width: 100%;
}

.register-form__code-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-1) var(--spacing-3);
  margin-right: calc(-1 * var(--spacing-2));
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-primary);
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-border);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition-fast-out);
  height: 24px;
}

.register-form__code-btn:disabled {
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .register-form__code-btn:hover:not(:disabled) {
    color: var(--color-primary-dark);
  }
}

.register-form__code-loading {
  display: inline-block;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.register-form__icon {
  color: var(--color-text-tertiary);
}

.register-form__submit {
  margin-top: var(--spacing-4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  height: 48px;
  font-size: var(--text-base);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  border: none;
  color: white;
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wide);
  transition: var(--transition-normal-out);
  box-shadow: 0 4px 12px rgba(143, 181, 163, 0.3);
}

@media (hover: hover) and (pointer: fine) {
  .register-form__submit:hover {
    background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
    box-shadow: 0 6px 16px rgba(143, 181, 163, 0.4);
    transform: translateY(-1px);
  }
}

.register-form__submit:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(143, 181, 163, 0.3);
}

.dark .register-form__submit {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  box-shadow: 0 4px 12px rgba(120, 120, 120, 0.3);
}

.dark .register-form__submit:hover {
  box-shadow: 0 6px 16px rgba(120, 120, 120, 0.4);
}

.register-form__footer {
  text-align: center;
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-wider);
}

.register-form__footer-text {
  color: var(--color-text-secondary);
}

.register-form__footer-link {
  color: var(--color-primary);
  font-weight: var(--font-medium);
  cursor: pointer;
  margin-left: var(--spacing-2);
  transition: color var(--transition-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .register-form__footer-link:hover {
    color: var(--color-primary-light);
  }
}

.register-form__footer-link:active {
  transform: scale(0.95);
}

@media (min-width: 769px) {
  .register-container {
    max-width: 800px;
    gap: var(--spacing-10);
  }
}
</style>
