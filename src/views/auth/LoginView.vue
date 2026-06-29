<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, User, ArrowRight } from '@/components/base/Icon/icons'
import { useAuthStore } from '@/stores/auth'
import Input from '@/components/form/Input/Input.vue'
import Button from '@/components/actions/Button/Button.vue'
import Card from '@/components/data/Card/Card.vue'
import { useToast } from '@/components/feedback/Toast/toast'

const router = useRouter()
const authStore = useAuthStore()
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
    <div class="login-container">
      <!-- 品牌区域 -->
      <div class="login-brand">
        <h1 class="login-brand__title">寻忆</h1>
        <p class="login-brand__subtitle">让时光驻留，让记忆重现。</p>
      </div>

      <!-- 登录卡片 -->
      <Card class="login-card" shadow="lg" padding="lg">
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
      </Card>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-bg-primary), var(--color-bg-secondary));
  padding: var(--spacing-4);
}

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-10);
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

.login-card {
  width: 380px;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.dark .login-card {
  background: rgba(45, 45, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

.login-form__field {
  width: 100%;
}

.login-form__icon {
  color: var(--color-text-tertiary);
}

.login-form__submit {
  margin-top: var(--spacing-2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
}

.login-form__footer {
  margin-top: var(--spacing-6);
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
    flex-direction: row;
    gap: var(--spacing-16);
  }

  .login-brand {
    text-align: left;
  }
}
</style>
