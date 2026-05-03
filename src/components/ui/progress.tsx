import * as React from 'react';
import { cn } from '@/lib/utils';

export function Progress({ value, className, ...props }: React.ComponentProps<'div'> & { value: number }) {
  return (
    <div className={cn('ui-progress', className)} {...props}>
      <div className="ui-progress-bar" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
