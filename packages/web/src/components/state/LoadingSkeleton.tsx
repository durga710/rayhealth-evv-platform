import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

export function LoadingSkeleton({ rows = 5, columns = 4 }: LoadingSkeletonProps) {
  const rowList = Array.from({ length: rows });
  const colList = Array.from({ length: columns });

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      data-testid="loading-skeleton"
      style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: 'white',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.95rem',
      }}
    >
      {rowList.map((_, r) => (
        <div
          key={r}
          data-testid="skeleton-row"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '0.85rem',
          }}
        >
          {colList.map((__, c) => (
            <div
              key={c}
              className="rh-skeleton-cell"
              style={{
                height: c === 0 ? '16px' : '12px',
                opacity: 0.45 + ((rows - r) / rows) * 0.55,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
