import React from 'react';
import { Link } from 'react-router-dom';

interface CTA {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  body?: string;
  cta?: CTA;
}

export function EmptyState({ title, body, cta }: EmptyStateProps) {
  const cardStyle: React.CSSProperties = {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    backgroundColor: 'white',
    border: '1px dashed var(--color-border-strong)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.85rem',
  };

  const iconStyle: React.CSSProperties = {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-surface-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-subtle)',
    border: '1px solid var(--color-border)',
  };

  const ctaStyle: React.CSSProperties = {
    marginTop: '0.75rem',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: '1px solid var(--color-primary)',
    padding: '0.55rem 1.1rem',
    borderRadius: '8px',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0.875rem',
    display: 'inline-block',
    fontFamily: 'inherit',
  };

  return (
    <div style={cardStyle} role="status">
      <div aria-hidden="true" style={iconStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <h4 style={{ margin: 0, color: 'var(--color-text)', fontSize: '0.9375rem', fontWeight: 600 }}>{title}</h4>
      {body && (
        <p style={{ margin: 0, color: 'var(--color-text-muted)', maxWidth: '36ch', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {cta && cta.to && (
        <Link to={cta.to} style={ctaStyle}>
          {cta.label}
        </Link>
      )}
      {cta && !cta.to && (
        <button type="button" onClick={cta.onClick} style={ctaStyle}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
