import { ref } from 'vue'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastOptions {
  /** 自动关闭延迟（ms），默认 3000。设为 0 不自动关闭 */
  duration?: number
  /** 是否显示关闭按钮，默认 false */
  closable?: boolean
}

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration: number
  closable: boolean
}

// 全局单例状态
const toasts = ref<ToastItem[]>([])

let nextId = 0

function generateId(): string {
  return `toast-${++nextId}`
}

function add(type: ToastType, message: string, options?: ToastOptions) {
  const id = generateId()
  const toast: ToastItem = {
    id,
    type,
    message,
    duration: options?.duration ?? 3000,
    closable: options?.closable ?? false,
  }
  toasts.value.push(toast)

  // 自动移除
  if (toast.duration > 0) {
    setTimeout(() => remove(id), toast.duration)
  }
}

function remove(id: string) {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) toasts.value.splice(index, 1)
}

export function useToast() {
  return {
    toasts,
    success: (msg: string, opts?: ToastOptions) => add('success', msg, opts),
    warning: (msg: string, opts?: ToastOptions) => add('warning', msg, opts),
    error: (msg: string, opts?: ToastOptions) => add('error', msg, opts),
    info: (msg: string, opts?: ToastOptions) => add('info', msg, opts),
    remove,
  }
}
