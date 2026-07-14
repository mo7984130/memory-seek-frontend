<script setup lang="ts">
import Modal from '../Modal/Modal.vue'
import Button from '../../actions/Button/Button.vue'
import type { Variant } from '../../_shared/types'

interface Props {
  /** 是否显示 */
  modelValue: boolean
  /** 弹窗标题 */
  title?: string
  /** 确认按钮文本 */
  confirmText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 确认按钮 variant */
  confirmVariant?: Variant
  /** 是否加载中 */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  confirmText: '确认',
  cancelText: '取消',
  confirmVariant: 'danger',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function handleCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="sm"
    :title="title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="confirm-modal__content">
      <p class="confirm-modal__text">
        <slot />
      </p>
      <div class="confirm-modal__actions">
        <Button variant="outline" type="button" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button
          :variant="confirmVariant"
          type="button"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.confirm-modal__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.confirm-modal__text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

.confirm-modal__actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
}
</style>
