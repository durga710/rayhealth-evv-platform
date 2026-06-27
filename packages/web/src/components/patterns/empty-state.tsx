import * as React from 'react';
import { type LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.ComponentProps<'div'> {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Primary action(s) — e.g. a "Create" button. */
  action?: React.ReactNode;
  /** Compact removes the dashed border + tall padding (for inline empties). */
  compact?: boolean;
}

/**
 * Canonical empty state for lists, tables, and panels. Replaces the dashed
 * placeholder that was hand-rolled across feature pages.
 */
function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact
          ? 'py-8'
          : 'rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14',
        className,
      )}
      {...props}
    >
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5.5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
