<script setup lang="ts">
import { computed, ref } from 'vue'
import { inputVariants } from './input.variants'
import type { Size, Status } from '../../_shared/types'
import Icon from '../../base/Icon/Icon.vue'
import './input.css'

interface Props {
  size?: Size
  status?: Status
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  type?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  status: 'default',
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  keydown: [event: KeyboardEvent]
}>()

const inputRef = ref<HTMLInputElement>()

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })

const showClear = computed(() => props.clearable && props.modelValue && !props.disabled)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onClear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div
    :class="[
      inputVariants({ size, status }),
      { 'input--disabled': disabled },
    ]"
  >
    <span v-if="$slots.prefix" class="input__prefix">
      <slot name="prefix" />
    </span>
    <input
      ref="inputRef"
      class="input__field"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="status === 'error'"
      :aria-disabled="disabled"
      @input="onInput"
      @keydown="emit('keydown', $event)"
    />
    <button
      v-if="showClear"
      class="input__clear"
      type="button"
      aria-label="清除输入"
      @click="onClear"
    >
      <Icon name="CloseIcon" :size="16" />
    </button>
    <span v-if="$slots.suffix" class="input__suffix">
      <slot name="suffix" />
    </span>
  </div>
</template>
