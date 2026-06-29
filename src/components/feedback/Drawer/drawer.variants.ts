import { cva } from '../../_shared/cva'

export const drawerVariants = cva('drawer__panel', {
  variants: {
    placement: {
      left: 'drawer__panel--left',
      right: 'drawer__panel--right',
      top: 'drawer__panel--top',
      bottom: 'drawer__panel--bottom',
    },
    size: {
      sm: 'drawer__panel--sm',
      md: 'drawer__panel--md',
      lg: 'drawer__panel--lg',
      xl: 'drawer__panel--xl',
    },
  },
  defaultVariants: {
    placement: 'right',
    size: 'md',
  },
})
