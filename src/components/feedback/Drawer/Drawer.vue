<script setup lang="ts">
import { drawerVariants } from './drawer.variants'
import type { Placement, Size } from '../../_shared/types'
import Icon from '../../base/Icon/Icon.vue'
import './drawer.css'

interface Props {
  modelValue?: boolean
  placement?: Placement
  size?: Size
  title?: string
  closable?: boolean
  maskClosable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'right',
  size: 'md',
  closable: true,
  maskClosable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}

function onMaskClick() {
  if (props.maskClosable) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <template v-if="modelValue">
      <div class="drawer-overlay" @click="onMaskClick" />
      <div :class="drawerVariants({ placement, size })">
        <div v-if="title || closable" class="drawer__header">
          <h3 v-if="title" class="drawer__title">{{ title }}</h3>
          <button v-if="closable" class="drawer__close" type="button" @click="close">
            <Icon name="CloseIcon" :size="20" />
          </button>
        </div>
        <div class="drawer__body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="drawer__footer">
          <slot name="footer" />
        </div>
      </div>
    </template>
  </Teleport>
</template>
