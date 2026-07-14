import { cva } from '../../_shared/cva'

export const tooltipVariants = cva('tooltip', {
  variants: {
    placement: {
      top: 'tooltip--top',
      right: 'tooltip--right',
      bottom: 'tooltip--bottom',
      left: 'tooltip--left',
    },
  },
  defaultVariants: {
    placement: 'top',
  },
})
