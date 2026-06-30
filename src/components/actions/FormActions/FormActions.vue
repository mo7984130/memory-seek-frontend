<script setup lang="ts">
import Button from '../Button/Button.vue'
import type { Variant, Size } from '../../_shared/types'

interface Props {
  /** 提交按钮文本 */
  submitText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 是否显示取消按钮 */
  showCancel?: boolean
  /** 提交按钮 variant */
  submitVariant?: Variant
  /** 提交按钮是否加载中 */
  loading?: boolean
  /** 提交按钮是否禁用 */
  disabled?: boolean
  /** 按钮尺寸 */
  size?: Size
}

const props = withDefaults(defineProps<Props>(), {
  submitText: '保存',
  cancelText: '取消',
  showCancel: true,
  submitVariant: 'primary',
  size: 'md',
})

const emit = defineEmits<{
  submit: []
  cancel: []
}>()
</script>

<template>
  <div class="form-actions">
    <Button
      v-if="showCancel"
      variant="outline"
      :size="size"
      type="button"
      @click="emit('cancel')"
    >
      {{ cancelText }}
    </Button>
    <Button
      :variant="submitVariant"
      :size="size"
      :loading="loading"
      :disabled="disabled"
      type="button"
      block
      @click="emit('submit')"
    >
      {{ submitText }}
    </Button>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: var(--spacing-3);
  margin-top: var(--spacing-2);
}

.form-actions :deep(.btn--block) {
  flex: 1;
}
</style>
