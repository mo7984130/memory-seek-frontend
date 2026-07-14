<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { textareaVariants } from './textarea.variants'
import type { Status } from '../../_shared/types'
import './textarea.css'

interface Props {
  status?: Status
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  rows?: number
  maxlength?: number
  autosize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  status: 'default',
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const fieldRef = ref<HTMLTextAreaElement>()

const charCount = computed(() => props.modelValue?.length ?? 0)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  if (props.autosize) {
    adjustHeight(target)
  }
}

function adjustHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// autosize 时初始化高度
onMounted(() => {
  if (props.autosize && fieldRef.value && props.modelValue) {
    nextTick(() => {
      if (fieldRef.value) adjustHeight(fieldRef.value)
    })
  }
})
</script>

<template>
  <div :class="[textareaVariants({ status })]">
    <textarea
      ref="fieldRef"
      class="textarea__field"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :maxlength="maxlength"
      @input="onInput"
    />
    <div v-if="maxlength" class="textarea__count">
      {{ charCount }} / {{ maxlength }}
    </div>
  </div>
</template>
