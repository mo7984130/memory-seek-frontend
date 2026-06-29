import { cva } from '../../_shared/cva'

export const modalVariants = cva('modal__dialog', {
  variants: {
    size: {
      sm: 'modal__dialog--sm',
      md: 'modal__dialog--md',
      lg: 'modal__dialog--lg',
      xl: 'modal__dialog--xl',
      full: 'modal__dialog--full',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
