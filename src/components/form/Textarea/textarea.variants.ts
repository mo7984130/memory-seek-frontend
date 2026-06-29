import { cva } from '../../_shared/cva'

export const textareaVariants = cva('textarea', {
  variants: {
    status: {
      default: '',
      error: 'textarea--error',
      success: 'textarea--success',
    },
  },
  defaultVariants: {
    status: 'default',
  },
})
