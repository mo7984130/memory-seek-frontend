<script setup lang="ts">
import { buttonVariants } from './button.variants'
import type { Variant, Size } from '../../_shared/types'
import Spinner from '../../base/Spinner/Spinner.vue'
import './button.css'

interface Props {
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    :class="[
      buttonVariants({ variant, size }),
      { 'btn--block': block, 'btn--loading': loading },
    ]"
    :disabled="disabled || loading"
  >
    <Spinner v-if="loading" :size="size" />
    <slot />
  </button>
</template>
