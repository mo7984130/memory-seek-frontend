import { cva } from '../../_shared/cva'

export const cardVariants = cva('card', {
  variants: {
    shadow: {
      none: 'card--shadow-none',
      sm: 'card--shadow-sm',
      md: 'card--shadow-md',
      lg: 'card--shadow-lg',
      hover: 'card--shadow-hover',
    },
    padding: {
      none: 'card--padding-none',
      sm: 'card--padding-sm',
      md: 'card--padding-md',
      lg: 'card--padding-lg',
    },
  },
  defaultVariants: {
    shadow: 'md',
    padding: 'md',
  },
})
