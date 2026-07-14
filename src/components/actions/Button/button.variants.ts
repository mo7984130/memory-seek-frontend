import { cva } from '../../_shared/cva'

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
