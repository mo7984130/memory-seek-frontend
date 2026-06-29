import './styles/variables.css'
import './styles/global.css'
import './components/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initApiConfig, setMessageHandler } from 'memory-seek-api'
import { useToast } from '@/components/feedback/Toast/toast'

import App from './App.vue'
import router from './router'

// 初始化 API 配置 — 必须在任何组件使用 API 之前
initApiConfig({
  baseUrl: 'https://memory-seek.driftcloud.cn/api',
  timeout: 10000,
})

const toast = useToast()
setMessageHandler({
  error: (msg: string) => toast.error(msg),
  success: (msg: string) => toast.success(msg),
  refreshTokenFail: () => router.push('/login'),
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
