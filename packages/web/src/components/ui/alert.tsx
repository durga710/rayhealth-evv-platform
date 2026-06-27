import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  type LucideIcon,
  Info,
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:size-4.5 [&>svg]:shrink-0 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground [&>svg]:text-muted-foreground',
        info: 'border-info/25 bg-info-subtle text-info-subtle-foreground [&>svg]:text-info',
        success:
          'border-success/25 bg-success-subtle text-success-subtle-foreground [&>svg]:text-success',
        warning:
          'border-warning/30 bg-warning-subtle text-warning-subtle-foreground [&>svg]:text-warning',
        destructive:
          'border-destructive/25 bg-destructive-subtle text-destructive-subtle-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const DEFAULT_ICONS: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: CircleAlert,
};

interface AlertProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof alertVariants> {
  /** Override the default variant icon. Pass `null` to hide it. */
  icon?: LucideIcon | null;
}

function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  const resolved = variant ?? 'default';
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICONS[resolved]);
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden /> : null}
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="alert-title" className={cn('font-semibold tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-description"
      className={cn('text-sm opacity-90 [&_a]:font-medium [&_a]:underline', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
export type { AlertProps };
