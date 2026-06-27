import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Content placeholder shown while data loads. Uses a subtle pulse on the muted
 * surface; honors prefers-reduced-motion via the global base reset.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
