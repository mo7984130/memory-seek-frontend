<script setup lang="ts">
import type { Size } from '../../_shared/types'
import './spinner.css'

interface Props {
  size?: Size
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})
</script>

<template>
  <div :class="['spinner', `spinner--${size}`]">
    <div
      class="spinner__circle"
      :style="color ? { borderTopColor: color } : undefined"
    />
  </div>
</template>
