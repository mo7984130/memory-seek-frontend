import { cva } from '../../_shared/cva'

export const inputVariants = cva('input', {
  variants: {
    size: {
      sm: 'input--sm',
      md: 'input--md',
      lg: 'input--lg',
    },
    status: {
      default: '',
      error: 'input--error',
      success: 'input--success',
    },
  },
  defaultVariants: {
    size: 'md',
    status: 'default',
  },
})
