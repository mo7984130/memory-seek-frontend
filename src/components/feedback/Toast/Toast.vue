<script setup lang="ts">
import { toastVariants } from './toast.variants'
import { useToast } from './toast'
import type { ToastItem } from './toast'
import Icon from '../../base/Icon/Icon.vue'
import './toast.css'

const { toasts, remove } = useToast()

const iconMap: Record<ToastItem['type'], string> = {
  success: 'SuccessIcon',
  warning: 'WarningIcon',
  error: 'ErrorIcon',
  info: 'InfoIcon',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="toastVariants({ type: toast.type })"
      >
        <span class="toast__icon">
          <Icon :name="iconMap[toast.type] as any" :size="18" />
        </span>
        <span class="toast__message">{{ toast.message }}</span>
        <button
          v-if="toast.closable"
          class="toast__close"
          type="button"
          @click="remove(toast.id)"
        >
          <Icon name="CloseIcon" :size="14" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
