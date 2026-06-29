import { cva } from '../../_shared/cva'

export const toastVariants = cva('toast', {
  variants: {
    type: {
      success: 'toast--success',
      warning: 'toast--warning',
      error: 'toast--error',
      info: 'toast--info',
    },
  },
  defaultVariants: {
    type: 'info',
  },
})
