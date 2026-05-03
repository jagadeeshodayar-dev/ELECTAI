import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'ui-button',
  {
    variants: {
      variant: {
        default: 'ui-button-primary',
        secondary: 'ui-button-secondary',
        ghost: 'ui-button-ghost',
        outline: 'ui-button-outline',
      },
      size: {
        default: 'ui-button-default',
        sm: 'ui-button-sm',
        lg: 'ui-button-lg',
        icon: 'ui-button-icon',
        mic: 'ui-button-mic',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = 'Button';
