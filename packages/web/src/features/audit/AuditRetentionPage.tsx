import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';

/**
 * Admin-only HIPAA audit-retention evidence dashboard.
 *
 * Backed by `GET /api/admin/audit-retention/status` (capability
 * `audit.read`, admin-only). Surfaces the data an HHS auditor or an
 * agency compliance officer needs to demonstrate that audit logs are
 * being retained per 45 CFR §164.530(j) — without exposing PHI.
 */

interface RetentionStatus {
  totalRows: number;
  oldestOccurredAt: string | null;
  eventsLast30Days: number;
  eventsApproachingSixYearLimit: number;
  retentionFloorYears: number;
  immutabilityTrigger: string;
}

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid #e2e8f0'
};

const stat: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem'
};

const statValue: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  color: 'var(--color-primary-dark, #0d1f3c)',
  lineHeight: 1
};

const statLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em'
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function AuditRetentionPage() {
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getJson<RetentionStatus>('/api/admin/audit-retention/status')
      .then((data) => {
        setStatus(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load retention status');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Audit Log Retention</h2>
      <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted, #64748b)' }}>
        HIPAA evidence dashboard — 45 CFR §164.530(j) requires 6-year retention of audit logs.
        This page reports the data of record without exposing PHI.
      </p>

      {loading && (
        <div style={{ ...card, textAlign: 'center', color: '#64748b' }}>Loading…</div>
      )}

      {!loading && error && (
        <div role="alert" style={{ ...card, backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {!loading && !error && status && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div
            style={{
              ...card,
              backgroundColor:
                status.eventsApproachingSixYearLimit > 0 ? '#fffbeb' : '#f0fdf4',
              borderColor:
                status.eventsApproachingSixYearLimit > 0 ? '#fcd34d' : '#86efac'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: status.eventsApproachingSixYearLimit > 0 ? '#b45309' : '#15803d' }}>
              Compliance status
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '0.4rem', color: status.eventsApproachingSixYearLimit > 0 ? '#92400e' : '#14532d' }}>
              {status.eventsApproachingSixYearLimit > 0 ? (
                <>
                  {formatNumber(status.eventsApproachingSixYearLimit)} event(s) older than 5y 9m —
                  schedule cold-storage extraction within 90 days to stay above the{' '}
                  {status.retentionFloorYears}-year statutory floor.
                </>
              ) : (
                <>
                  All retained events are within the {status.retentionFloorYears}-year floor.
                  No archival action required.
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={card}>
              <div style={stat}>
                <div style={statLabel}>Total events</div>
                <div style={statValue}>{formatNumber(status.totalRows)}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>retained for this agency</div>
              </div>
            </div>
            <div style={card}>
              <div style={stat}>
                <div style={statLabel}>Last 30 days</div>
                <div style={statValue}>{formatNumber(status.eventsLast30Days)}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>recent activity</div>
              </div>
            </div>
            <div style={card}>
              <div style={stat}>
                <div style={statLabel}>Oldest event</div>
                <div style={statValue}>
                  {status.oldestOccurredAt ? `${daysSince(status.oldestOccurredAt)}d` : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {status.oldestOccurredAt
                    ? new Date(status.oldestOccurredAt).toISOString().slice(0, 10)
                    : 'no events yet'}
                </div>
              </div>
            </div>
            <div style={card}>
              <div style={stat}>
                <div style={statLabel}>Approaching 6y limit</div>
                <div
                  style={{
                    ...statValue,
                    color: status.eventsApproachingSixYearLimit > 0 ? '#b45309' : '#15803d'
                  }}
                >
                  {formatNumber(status.eventsApproachingSixYearLimit)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>older than 5y 9m</div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={statLabel}>Append-only enforcement</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Postgres trigger{' '}
              <code style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                {status.immutabilityTrigger}
              </code>{' '}
              blocks UPDATE and DELETE on <code>audit_events</code> at the database
              layer. Application code physically cannot mutate or remove a logged event.
            </div>
          </div>

          <div style={{ ...card, backgroundColor: '#f8fafc' }}>
            <div style={statLabel}>Statutory reference</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              45 CFR §164.530(j) — <em>Documentation</em>. Covered entities must retain
              required documentation, including audit logs of access to ePHI, for{' '}
              <strong>{status.retentionFloorYears} years</strong> from the date of its
              creation or the date when it last was in effect, whichever is later.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
