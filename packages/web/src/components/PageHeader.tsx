import * as React from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional actions rendered on the right (e.g. a primary Button). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page title block for admin pages: display-font heading,
 * muted description, and an optional right-aligned actions slot.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
