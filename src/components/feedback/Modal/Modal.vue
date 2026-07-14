<script setup lang="ts">
import { modalVariants } from './modal.variants'
import Icon from '../../base/Icon/Icon.vue'
import './modal.css'

// Teleport 根节点无法继承 fallthrough attrs（class/style 等），显式禁用避免警告
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  title?: string
  closable?: boolean
  maskClosable?: boolean
  /**
   * 自定义 class 扩展点。
   *
   * Modal 使用 Teleport 渲染到 body，导致：
   * 1. 父组件的 scoped 样式（:deep()）无法穿透 —— data-v-xxx 属性链在 Teleport 边界断裂
   * 2. 全局 CSS 覆盖不可靠 —— modal.css 通过组件 import 被 Vite 动态注入，加载时机不可控
   *
   * 因此需要通过 prop 将自定义 class 直接挂在目标元素上，
   * 配合全局 CSS 选择器实现样式覆盖。
   */
  overlayClass?: string
  dialogClass?: string
  bodyClass?: string
}

const props = withDefaults(defineProps<Props>(), {
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
    <div v-if="modelValue" :class="['modal-overlay', overlayClass]" @click.self="onMaskClick">
      <div :class="[modalVariants({ size }), dialogClass]">
        <div v-if="title || closable || $slots['header-extra']" class="modal__header">
          <h3 v-if="title" class="modal__title">{{ title }}</h3>
          <div class="modal__header-extra">
            <slot name="header-extra" />
            <button v-if="closable" class="modal__close" type="button" @click="close">
              <Icon name="CloseIcon" :size="20" />
            </button>
          </div>
        </div>
        <div :class="['modal__body', bodyClass]">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal__footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
