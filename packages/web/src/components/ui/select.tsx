import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Lightweight native <select> wrapper styled to match the shadcn Input.
 * Avoids pulling in @radix-ui/react-select for the handful of simple
 * single-value dropdowns the admin pages need.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          'border-input flex h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-1 pr-9 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { Select };
