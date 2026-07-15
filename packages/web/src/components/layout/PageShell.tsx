import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * The outer vertical rhythm for a full admin/portal page: a single flex
 * column with a consistent gap between the header, banners, and sections.
 * Replaces the repeated `style={{ display: 'flex', flexDirection: 'column',
 * gap: '1.75rem' }}` wrapper that several screens hand-rolled.
 */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={className ? `page-shell ${className}` : 'page-shell'}>{children}</div>;
}
