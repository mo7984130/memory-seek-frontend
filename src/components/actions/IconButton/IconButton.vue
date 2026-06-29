<script setup lang="ts">
import type { Variant, Size, Shape } from '../../_shared/types'
import Spinner from '../../base/Spinner/Spinner.vue'
import './icon-button.css'

interface Props {
  variant?: Variant
  size?: Size
  shape?: Shape
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'md',
  shape: 'circle',
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    :class="[
      'icon-btn',
      `icon-btn--${variant}`,
      `icon-btn--${size}`,
      `icon-btn--${shape}`,
      { 'icon-btn--loading': loading },
    ]"
    :disabled="disabled || loading"
  >
    <Spinner v-if="loading" :size="size" />
    <slot v-else />
  </button>
</template>
