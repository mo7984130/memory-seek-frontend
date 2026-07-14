import { cva } from '../../_shared/cva'

export const selectVariants = cva('select', {
  variants: {
    size: {
      sm: 'select--sm',
      md: 'select--md',
      lg: 'select--lg',
    },
    status: {
      default: '',
      error: 'select--error',
      success: 'select--success',
    },
  },
  defaultVariants: {
    size: 'md',
    status: 'default',
  },
})
