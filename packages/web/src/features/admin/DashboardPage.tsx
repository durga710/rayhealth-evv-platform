import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson } from '../../lib/api-client.js';

interface CountState {
  clients: number | null;
  staff: number | null;
  assignments: number | null;
  visits: number | null;
  complianceRate: number | null;
}

const initialCounts: CountState = {
  clients: null,
  staff: null,
  assignments: null,
  visits: null,
  complianceRate: null,
};

function formatCount(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat().format(value);
}

const quickActions = [
  {
    title: 'Add a new client',
    body: 'Capture demographics, Medicaid id, and authorizations in one step.',
    to: '/admin/clients',
    cta: 'Open clients',
  },
  {
    title: 'Invite a coordinator or caregiver',
    body: 'Send a credential-aware invite with the right capability scope.',
    to: '/admin/staff',
    cta: 'Open staff',
  },
  {
    title: 'Build a visit template',
    body: 'Compose PA-coded tasks once, reuse across clients and shifts.',
    to: '/admin/templates',
    cta: 'Open templates',
  },
  {
    title: 'Schedule the week',
    body: 'Assign credentialed caregivers to authorizations with eligibility checks.',
    to: '/admin/assignments',
    cta: 'Open assignments',
  },
  {
    title: 'Review training compliance',
    body: 'PA §52.18 caregiver training rollup with overdue and expiring certification alerts.',
    to: '/admin/learning',
    cta: 'Open Learning Hub',
  },
];

const securityHighlights = [
  { label: 'Auth method', value: 'HttpOnly cookie session' },
  { label: 'CSRF protection', value: 'Double-submit token, rotated on each /me' },
  { label: 'Audit trail', value: 'auth.login • session.revoked • csrf.failure' },
  { label: 'Mobile auth', value: 'expo-secure-store, never in plain JS' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<CountState>(initialCounts);

  useEffect(() => {
    let cancelled = false;

    const safeCount = async <T,>(path: string): Promise<number | null> => {
      try {
        const data = await getJson<T[] | { items: T[] }>(path);
        if (Array.isArray(data)) return data.length;
        if (data && Array.isArray((data as { items: T[] }).items)) {
          return (data as { items: T[] }).items.length;
        }
        return 0;
      } catch {
        return null;
      }
    };

    const safeRollup = async (): Promise<number | null> => {
      try {
        const res = await getJson<{ success: boolean; data: { complianceRate: number } }>('/api/learning/rollup');
        return res.success ? Math.round(res.data.complianceRate * 100) : null;
      } catch {
        return null;
      }
    };

    Promise.all([
      safeCount('/api/clients'),
      safeCount('/api/staff'),
      safeCount('/api/assignments'),
      safeCount('/api/evv'),
      safeRollup(),
    ]).then(([clients, staff, assignments, visits, complianceRate]) => {
      if (cancelled) return;
      setCounts({ clients, staff, assignments, visits, complianceRate });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = user ? `Welcome back, ${user.role}.` : 'Welcome back.';

  const complianceDisplay = counts.complianceRate === null ? '—' : `${counts.complianceRate}%`;
  const complianceTint = counts.complianceRate === null ? '#94a3b8' : counts.complianceRate >= 80 ? '#16a34a' : '#dc2626';

  const stats = [
    { label: 'Active clients', value: formatCount(counts.clients), tint: '#1a5fa8' },
    { label: 'Staff & caregivers', value: formatCount(counts.staff), tint: '#3886d5' },
    { label: 'Open assignments', value: formatCount(counts.assignments), tint: '#0f766e' },
    { label: 'Visits this period', value: formatCount(counts.visits), tint: '#f97316' },
    { label: 'Training compliance', value: complianceDisplay, tint: complianceTint },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            color: '#15803d',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            padding: '0.3rem 0.7rem',
            borderRadius: '999px',
            alignSelf: 'flex-start',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '999px',
              backgroundColor: '#16a34a',
              boxShadow: '0 0 0 3px rgba(22,163,74,0.2)',
            }}
          />
          Cookie session active
        </div>
        <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--color-primary-dark)' }}>{greeting}</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem', maxWidth: '720px' }}>
          A snapshot of the agency's day-to-day, plus the security posture auditors will ask about.
        </p>
      </header>

      {/* Stats */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2eaf2',
              borderRadius: '14px',
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(26,95,168,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                aria-hidden
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '999px',
                  backgroundColor: s.tint,
                }}
              />
              <span
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  fontWeight: 700,
                }}
              >
                {s.label}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.25rem',
                fontWeight: 900,
                color: 'var(--color-primary-dark)',
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <h2 style={{ margin: '0 0 1rem', color: 'var(--color-primary-dark)', fontSize: '1.125rem' }}>Quick actions</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {quickActions.map((q) => (
            <div
              key={q.title}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e2eaf2',
                borderRadius: '14px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '1rem', lineHeight: 1.3 }}>
                {q.title}
              </h3>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.5, flex: 1 }}>
                {q.body}
              </p>
              <Link
                to={q.to}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '0.25rem',
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }}
              >
                {q.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Security highlights */}
      <section>
        <h2 style={{ margin: '0 0 1rem', color: 'var(--color-primary-dark)', fontSize: '1.125rem' }}>Security posture</h2>
        <div
          style={{
            backgroundColor: 'var(--color-primary-dark)',
            color: 'white',
            borderRadius: '14px',
            padding: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {securityHighlights.map((h) => (
            <div key={h.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 700,
                }}
              >
                {h.label}
              </span>
              <span style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>{h.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
