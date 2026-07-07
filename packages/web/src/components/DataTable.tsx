import type { ReactNode } from 'react';
import { EmptyState, ErrorRetry, LoadingSkeleton } from './state/index.js';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface DataTableEmptyProps {
  title: string;
  body?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  error?: string | null;
  onRetry?: () => void;
  /** Shown when not loading, no error, and `rows` is empty. */
  empty?: DataTableEmptyProps;
  /** Visually-hidden `<caption>` describing the table for screen readers. */
  caption?: string;
}

/**
 * A generic, tokens-only table shell built on the existing `.data-table` /
 * `.table-scroll` classes. Handles the loading / error / empty branch that
 * every list screen re-implements by hand, so a new screen gets consistent
 * states (LoadingSkeleton / ErrorRetry / EmptyState) for free.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingRows = 5,
  error,
  onRetry,
  empty,
  caption,
}: DataTableProps<T>) {
  if (error && onRetry) {
    return <ErrorRetry message={error} onRetry={onRetry} />;
  }

  if (loading && rows.length === 0) {
    return <LoadingSkeleton rows={loadingRows} columns={columns.length} />;
  }

  if (!loading && rows.length === 0 && empty) {
    return <EmptyState title={empty.title} body={empty.body} />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align ? `data-table__align-${col.align}` : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align ? `data-table__align-${col.align}` : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
