# 寻忆前端基础组件系统设计

## 概述

为「寻忆」前端项目构建一套从零开始的基础 UI 组件系统。组件基于已有的 CSS 设计系统变量（`variables.css`），采用 Props + CVA（class-variance-authority）管理变体，全局 CSS + BEM 命名，确保修改任一变量时所有组件自动更新。

## 技术栈

- **框架**：Vue 3 + TypeScript + Vite
- **状态管理**：Pinia（已有）
- **变体管理**：class-variance-authority（需安装）
- **图标方案**：SVG 组件（Vite `?component` 后缀，零额外依赖）
- **样式策略**：全局 CSS + BEM 命名
- **路由**：Vue Router（已有）

## 设计原则

1. **变量驱动**：所有样式值通过 CSS 变量定义，不硬编码数值
2. **变量传递链路**：全局变量 → 组件变量 → CVA 变体 → 组件 Props
3. **组件可扩展**：组件可定义自己的 CSS 变量，引用上层全局变量
4. **类型安全**：Props 提供 TypeScript 类型推导，CVA 集中管理变体映射
5. **单一职责**：每个组件只做一件事，通过组合构建复杂 UI

## 目录结构

```
src/
├── styles/
│   └── variables.css              # 全局设计系统变量（已有）
├── components/
│   ├── index.css                  # 统一 @import 所有组件样式
│   ├── _shared/
│   │   ├── types.ts               # 共享类型（Size, Status, Variant）
│   │   └── cva.ts                 # CVA 统一导出
│   ├── base/
│   │   ├── Icon/
│   │   │   ├── Icon.vue
│   │   │   ├── icons.ts           # SVG 图标注册
│   │   │   └── svg/               # SVG 源文件
│   │   └── Spinner/
│   │       └── Spinner.vue
│   ├── actions/
│   │   ├── Button/
│   │   │   ├── Button.vue
│   │   │   ├── button.variants.ts
│   │   │   └── button.css
│   │   ├── IconButton/
│   │   │   ├── IconButton.vue
│   │   │   └── icon-button.css
│   │   └── ButtonGroup/
│   │       ├── ButtonGroup.vue
│   │       └── button-group.css
│   ├── data/
│   │   └── Card/
│   │       ├── Card.vue
│   │       ├── CardHeader.vue
│   │       ├── CardBody.vue
│   │       ├── CardFooter.vue
│   │       ├── card.variants.ts
│   │       └── card.css
│   ├── form/
│   │   ├── Input/
│   │   │   ├── Input.vue
│   │   │   ├── input.variants.ts
│   │   │   └── input.css
│   │   ├── Textarea/
│   │   │   ├── Textarea.vue
│   │   │   ├── textarea.variants.ts
│   │   │   └── textarea.css
│   │   └── Select/
│   │       ├── Select.vue
│   │       ├── select.variants.ts
│   │       └── select.css
│   └── feedback/
│       ├── Modal/
│       │   ├── Modal.vue
│       │   ├── modal.variants.ts
│       │   └── modal.css
│       ├── Drawer/
│       │   ├── Drawer.vue
│       │   ├── drawer.variants.ts
│       │   └── drawer.css
│       ├── Toast/
│       │   ├── Toast.vue
│       │   ├── toast.ts           # 命令式调用（useToast）
│       │   ├── toast.variants.ts
│       │   └── toast.css
│       └── Tooltip/
│           ├── Tooltip.vue
│           ├── tooltip.variants.ts
│           └── tooltip.css
```

## 组件 API 模式

所有组件遵循统一的 API 模式：Props 驱动 + CVA 变体映射。

### 核心模式

```typescript
// button.variants.ts
import { cva } from 'class-variance-authority'

export const buttonVariants = cva('btn', {
  variants: {
    variant: {
      primary: 'btn--primary',
      secondary: 'btn--secondary',
      outline: 'btn--outline',
      ghost: 'btn--ghost',
      danger: 'btn--danger',
    },
    size: {
      sm: 'btn--sm',
      md: 'btn--md',
      lg: 'btn--lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})
```

```vue
<!-- Button.vue -->
<script setup lang="ts">
import { buttonVariants } from './button.variants'
import type { Variant, Size } from '../_shared/types'

interface Props {
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
})
</script>

<template>
  <button
    :class="[
      buttonVariants({ variant, size }),
      { 'btn--block': block, 'btn--loading': loading },
    ]"
    :disabled="disabled || loading"
  >
    <slot />
  </button>
</template>
```

### 样式模式

```css
/* button.css — 组件级变量引用全局 + 定义组件特有 */
.btn {
  /* 组件特有变量 */
  --btn-height-sm: 32px;
  --btn-height-md: 40px;
  --btn-height-lg: 48px;
  --btn-padding-sm: var(--spacing-2) var(--spacing-3);
  --btn-padding-md: var(--spacing-3) var(--spacing-5);
  --btn-padding-lg: var(--spacing-4) var(--spacing-6);

  /* 基础样式，引用全局变量 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--btn-radius);
  font-weight: var(--btn-font-weight);
  transition: var(--btn-transition);
  cursor: pointer;
  border: 2px solid transparent;
}

/* 变体 */
.btn--primary {
  background: var(--color-primary);
  color: white;
}
.btn--primary:hover {
  background: var(--color-primary-dark);
}

/* 尺寸 */
.btn--sm { height: var(--btn-height-sm); padding: var(--btn-padding-sm); font-size: var(--text-sm); }
.btn--md { height: var(--btn-height-md); padding: var(--btn-padding-md); font-size: var(--text-base); }
.btn--lg { height: var(--btn-height-lg); padding: var(--btn-padding-lg); font-size: var(--text-lg); }

/* 状态 */
.btn--block { width: 100%; }
.btn--loading { opacity: 0.7; cursor: wait; }
.btn:disabled { opacity: var(--btn-disabled-opacity); cursor: not-allowed; }
```

## 共享基础设施

### 共享类型

```typescript
// components/_shared/types.ts
export type Size = 'sm' | 'md' | 'lg'
export type Status = 'default' | 'error' | 'success'
export type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type Placement = 'top' | 'right' | 'bottom' | 'left'
```

### CVA 统一导出

```typescript
// components/_shared/cva.ts
export { cva, type VariantProps } from 'class-variance-authority'
```

### 样式入口

```css
/* components/index.css */
@import './base/Icon/icon.css';
@import './base/Spinner/spinner.css';
@import './actions/Button/button.css';
@import './actions/IconButton/icon-button.css';
@import './actions/ButtonGroup/button-group.css';
@import './data/Card/card.css';
@import './form/Input/input.css';
@import './form/Textarea/textarea.css';
@import './form/Select/select.css';
@import './feedback/Modal/modal.css';
@import './feedback/Drawer/drawer.css';
@import './feedback/Toast/toast.css';
@import './feedback/Tooltip/tooltip.css';
```

在 `main.ts` 中引入：

```typescript
import './styles/variables.css'
import './components/index.css'
```

### Icon 系统

```typescript
// components/base/Icon/icons.ts
// SVG 图标集中注册，按需引入
export { default as CloseIcon } from './svg/close.svg?component'
export { default as CheckIcon } from './svg/check.svg?component'
export { default as LoadingIcon } from './svg/loading.svg?component'
export { default as ChevronDownIcon } from './svg/chevron-down.svg?component'
export { default as SearchIcon } from './svg/search.svg?component'
export { default as WarningIcon } from './svg/warning.svg?component'
export { default as InfoIcon } from './svg/info.svg?component'
export { default as SuccessIcon } from './svg/success.svg?component'
export { default as ErrorIcon } from './svg/error.svg?component'
```

```vue
<!-- components/base/Icon/Icon.vue -->
<script setup lang="ts">
import * as icons from './icons'

interface Props {
  name: keyof typeof icons
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
```

## 组件清单（第一批）

### base/ — 原子组件

| 组件 | 说明 | 关键 Props |
|------|------|-----------|
| Icon | SVG 图标渲染 | `name`, `size`, `color` |
| Spinner | 加载指示器 | `size`, `color` |

### actions/ — 交互组件

| 组件 | 说明 | 变体 |
|------|------|------|
| Button | 基础按钮 | variant: primary/secondary/outline/ghost/danger<br>size: sm/md/lg<br>loading, disabled, block |
| IconButton | 图标按钮 | 复用 Button 变体，圆形/方形 |
| ButtonGroup | 按钮组 | vertical（水平/垂直排列） |

### data/ — 数据展示

| 组件 | 说明 | 变体 |
|------|------|------|
| Card | 卡片容器 | shadow: none/sm/md/lg/hover<br>padding: none/sm/md/lg<br>hoverable, bordered |
| CardHeader | 卡片头部 | — |
| CardBody | 卡片内容 | — |
| CardFooter | 卡片底部 | — |

### form/ — 表单组件

| 组件 | 说明 | 变体 |
|------|------|------|
| Input | 输入框 | size: sm/md/lg<br>status: default/error/success<br>clearable, disabled |
| Textarea | 文本域 | rows, maxlength, autosize<br>status: default/error/success |
| Select | 下拉选择 | size: sm/md/lg<br>options, clearable, disabled |

### feedback/ — 反馈组件

| 组件 | 说明 | 变体 |
|------|------|------|
| Modal | 模态框 | size: sm/md/lg/xl/full<br>closable, maskClosable, title |
| Drawer | 抽屉 | placement: left/right/top/bottom<br>size: sm/md/lg/xl<br>closable, maskClosable |
| Toast | 消息提示 | type: success/warning/error/info<br>duration, closable<br>命令式调用：useToast() |
| Tooltip | 气泡提示 | placement: top/right/bottom/left<br>trigger: hover/click |

## 变量传递链路

```
variables.css          — 全局设计系统变量
    ↓
button.css             — .btn--primary { background: var(--color-primary) }
card.css               — .card { border-color: var(--color-border) }
input.css              — .input:focus { border-color: var(--color-primary) }
    ↓
CVA variants           — primary → 'btn--primary'
    ↓
Component Props        — <Button variant="primary" />
```

修改 `variables.css` 中的 `--color-primary` → 所有引用该变量的组件自动更新。

## 依赖变更

需新增依赖：

```bash
pnpm add class-variance-authority
```

需新增 Vite 配置（SVG 组件支持）：

```bash
pnpm add -D vite-svg-loader
```

在 `vite.config.ts` 中配置：

```typescript
import svgLoader from 'vite-svg-loader'

export default defineConfig({
  plugins: [vue(), svgLoader()],
})
```

## 不在范围内

- 业务组件（页面级组件）
- 路由配置和页面布局
- 国际化（i18n）
- 单元测试（后续补充）
- 动画库（使用 CSS 原生 transition）
