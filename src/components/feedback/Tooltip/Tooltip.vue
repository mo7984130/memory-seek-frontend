<script setup lang="ts">
import { ref } from 'vue'
import { tooltipVariants } from './tooltip.variants'
import type { Placement } from '../../_shared/types'
import './tooltip.css'

interface Props {
  content: string
  placement?: Placement
  trigger?: 'hover' | 'click'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  trigger: 'hover',
})

const isVisible = ref(false)

function show() {
  if (!props.disabled) isVisible.value = true
}

function hide() {
  isVisible.value = false
}

function toggle() {
  if (props.disabled) return
  isVisible.value = !isVisible.value
}

function onClickOutside() {
  if (props.trigger === 'click') hide()
}
</script>

<template>
  <div
    class="tooltip-wrapper"
    @mouseenter="trigger === 'hover' && show()"
    @mouseleave="trigger === 'hover' && hide()"
    @focusin="trigger === 'hover' && show()"
    @focusout="trigger === 'hover' && hide()"
    @click="trigger === 'click' && toggle()"
  >
    <slot />
    <div
      v-if="content"
      :class="[
        tooltipVariants({ placement }),
        { 'tooltip--visible': isVisible },
      ]"
      role="tooltip"
    >
      {{ content }}
      <div class="tooltip__arrow" />
    </div>
  </div>
</template>
