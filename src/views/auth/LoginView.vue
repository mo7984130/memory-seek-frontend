<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, User, ArrowRight, Sun, Moon } from '@/components/base/Icon/icons'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import Input from '@/components/form/Input/Input.vue'
import Button from '@/components/actions/Button/Button.vue'
import IconButton from '@/components/actions/IconButton/IconButton.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const toast = useToast()

// 表单状态
const account = ref('')
const password = ref('')
const loading = ref(false)

/**
 * 登录处理
 */
async function handleLogin() {
  // 表单验证
  if (!account.value.trim()) {
    toast.warning('请输入用户名')
    return
  }
  if (!password.value) {
    toast.warning('请输入密码')
    return
  }

  loading.value = true
  try {
    const success = await authStore.login(account.value, password.value)
    if (success) {
      toast.success('登录成功')
      await router.push('/photos')
    }
  } catch (error) {
    toast.error('登录失败: ' + error)
  } finally {
    loading.value = false
  }
}

/**
 * 跳转到注册页
 */
function handleRegister() {
  router.push('/register')
}
</script>

<template>
  <div class="login-view">
    <!-- 主题切换按钮 -->
    <IconButton class="auth-theme-btn" @click="themeStore.toggleTheme()">
      <Moon v-if="!themeStore.isDark" :size="20" />
      <Sun v-else :size="20" />
    </IconButton>

    <div class="login-container">
      <!-- 品牌区域 -->
      <div class="login-brand">
        <h1 class="login-brand__title">寻忆</h1>
        <p class="login-brand__subtitle">让时光驻留，让记忆重现。</p>
      </div>

      <!-- 登录表单 -->
      <form class="login-form" @submit.prevent="handleLogin">
        <!-- 用户名输入框 -->
        <div class="login-form__field">
          <Input v-model="account" placeholder="用户名 / 邮箱" size="lg">
            <template #prefix>
              <User :size="18" class="login-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 密码输入框 -->
        <div class="login-form__field">
          <Input v-model="password" type="password" placeholder="密码" size="lg">
            <template #prefix>
              <Lock :size="18" class="login-form__icon" />
            </template>
          </Input>
        </div>

        <!-- 登录按钮 -->
        <Button type="submit" size="lg" block :loading="loading" class="login-form__submit">
          登录
          <ArrowRight :size="18" />
        </Button>
      </form>

      <!-- 注册链接 -->
      <div class="login-form__footer">
        <span class="login-form__footer-text">还没有账号？</span>
        <span class="login-form__footer-link" @click="handleRegister"> 立即注册 </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-view {
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

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-8);
  width: 100%;
  max-width: 360px;
}

.login-brand {
  text-align: center;
}

.login-brand__title {
  font-size: var(--text-4xl);
  font-weight: var(--font-light);
  letter-spacing: 0.5em;
  color: var(--color-text-primary);
  font-family: var(--font-serif);
  margin: 0;
}

.login-brand__subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-4);
  letter-spacing: var(--tracking-wider);
}

.login-form {
  width: 360px;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-xl);
  padding: var(--spacing-8);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

.dark .login-form {
  background: rgba(45, 45, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-form__field {
  width: 100%;
}

.login-form__icon {
  color: var(--color-text-tertiary);
}

.login-form__submit {
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
  .login-form__submit:hover {
    background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
    box-shadow: 0 6px 16px rgba(143, 181, 163, 0.4);
    transform: translateY(-1px);
  }
}

.login-form__submit:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(143, 181, 163, 0.3);
}

.dark .login-form__submit {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  box-shadow: 0 4px 12px rgba(120, 120, 120, 0.3);
}

.dark .login-form__submit:hover {
  box-shadow: 0 6px 16px rgba(120, 120, 120, 0.4);
}

.login-form__footer {
  text-align: center;
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-wider);
}

.login-form__footer-text {
  color: var(--color-text-secondary);
}

.login-form__footer-link {
  color: var(--color-primary);
  font-weight: var(--font-medium);
  cursor: pointer;
  margin-left: var(--spacing-2);
  transition: color var(--transition-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .login-form__footer-link:hover {
    color: var(--color-primary-light);
  }
}

.login-form__footer-link:active {
  transform: scale(0.95);
}

@media (min-width: 769px) {
  .login-container {
    max-width: 700px;
    gap: var(--spacing-10);
  }
}
</style>
