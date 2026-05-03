import * as React from 'react';
import { cn } from '@/lib/utils';

export function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn('ui-alert', className)}
      {...props}
    />
  );
}
