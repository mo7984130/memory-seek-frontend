<script setup lang="ts">
import { cardVariants } from './card.variants'
import './card.css'

interface Props {
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'hover'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
  bordered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  shadow: 'md',
  padding: 'md',
  bordered: true,
})
</script>

<template>
  <div
    :class="[
      cardVariants({ shadow, padding }),
      { 'card--hoverable': hoverable },
    ]"
    :style="!bordered ? { border: 'none' } : undefined"
  >
    <slot />
  </div>
</template>
