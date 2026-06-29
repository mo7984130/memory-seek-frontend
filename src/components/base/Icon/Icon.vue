<script setup lang="ts">
import * as icons from './icons'
import './icon.css'

export type IconName = keyof typeof icons

interface Props {
  name: IconName
  size?: number | string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
})
</script>

<template>
  <component
    :is="icons[name]"
    class="icon"
    :style="{ width: `${size}px`, height: `${size}px`, color }"
  />
</template>
