<script setup lang="ts">
import './button-group.css'

interface Props {
  vertical?: boolean
}

defineProps<Props>()
</script>

<template>
  <div :class="['btn-group', { 'btn-group--vertical': vertical }]">
    <slot />
  </div>
</template>
