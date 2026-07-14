<script setup lang="ts">
import { ref, computed } from 'vue'
import { selectVariants } from './select.variants'
import type { Size, Status } from '../../_shared/types'
import Icon from '../../base/Icon/Icon.vue'
import './select.css'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  size?: Size
  status?: Status
  modelValue?: string | number
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  status: 'default',
  options: () => [],
  placeholder: '请选择',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

const isOpen = ref(false)

const selectedLabel = computed(() => {
  if (props.modelValue === undefined || props.modelValue === null) return ''
  const option = props.options.find(o => o.value === props.modelValue)
  return option?.label ?? ''
})

const showClear = computed(() => props.clearable && props.modelValue !== undefined && props.modelValue !== null && !props.disabled)

function toggle() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function close() {
  isOpen.value = false
}

function select(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
}

function onClear(event: Event) {
  event.stopPropagation()
  emit('update:modelValue', undefined)
  close()
}
</script>

<template>
  <div
    :class="[
      selectVariants({ size, status }),
      { 'select--open': isOpen, 'select--disabled': disabled },
    ]"
  >
    <div
      class="select__trigger"
      tabindex="0"
      role="combobox"
      :aria-expanded="isOpen"
      @click="toggle"
      @keydown.escape="close"
    >
      <span :class="['select__value', { 'select__placeholder': !selectedLabel }]">
        {{ selectedLabel || placeholder }}
      </span>
      <button
        v-if="showClear"
        class="select__clear"
        type="button"
        @click="onClear"
      >
        <Icon name="CloseIcon" :size="16" />
      </button>
      <span class="select__icon">
        <Icon name="ChevronDownIcon" :size="16" />
      </span>
    </div>
    <div class="select__dropdown">
      <div
        v-for="option in options"
        :key="option.value"
        :class="[
          'select__option',
          {
            'select__option--active': option.value === modelValue,
            'select__option--disabled': option.disabled,
          },
        ]"
        @click="select(option)"
      >
        {{ option.label }}
      </div>
    </div>
    <!-- 点击外部关闭 -->
    <div v-if="isOpen" class="select__overlay" @click="close" />
  </div>
</template>
