import React, { useEffect, useRef, useState } from 'react';
import { MarketingShell } from './MarketingShell.js';

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

interface Probe {
  at: number; // epoch ms
  ok: boolean;
  ms: number;
  error?: string;
}

const POLL_MS = 30_000;
const HISTORY = 20;

export function StatusPage() {
  const [probes, setProbes] = useState<Probe[]>([]);
  const [now, setNow] = useState(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const start = performance.now();
      try {
        const r = await fetch(`${API_BASE}/health?cb=${Date.now()}`, {
          headers: { accept: 'application/json' }
        });
        const ms = Math.round(performance.now() - start);
        const ok = r.ok;
        if (cancelled) return;
        setProbes((prev) => [...prev, { at: Date.now(), ok, ms }].slice(-HISTORY));
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        if (cancelled) return;
        setProbes((prev) =>
          [...prev, { at: Date.now(), ok: false, ms, error: (err as Error).message }].slice(-HISTORY)
        );
      }
      setNow(Date.now());
    };

    probe();
    timer.current = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const last = probes[probes.length - 1];
  const overall: 'green' | 'red' | 'unknown' = !last ? 'unknown' : last.ok ? 'green' : 'red';
  const uptimePct =
    probes.length === 0
      ? '—'
      : `${Math.round((probes.filter((p) => p.ok).length / probes.length) * 100)}%`;

  const statusColor: Record<typeof overall, string> = {
    green: '#16a34a',
    red: '#dc2626',
    unknown: '#94a3b8'
  };

  return (
    <MarketingShell
      eyebrow="System status"
      title={
        overall === 'green'
          ? 'All systems operational.'
          : overall === 'red'
            ? 'Degraded — investigating.'
            : 'Checking…'
      }
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '2rem auto 0',
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: statusColor[overall],
              boxShadow: `0 0 0 4px ${statusColor[overall]}33`
            }}
          />
          <strong style={{ color: 'var(--color-primary-dark)', fontSize: '1.1rem' }}>API</strong>
          <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Last probe: {last ? new Date(last.at).toLocaleTimeString() : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px', marginBottom: '0.5rem' }}>
          {Array.from({ length: HISTORY }).map((_, i) => {
            const offsetIndex = probes.length - HISTORY + i;
            const probe = offsetIndex >= 0 ? probes[offsetIndex] : undefined;
            const color = !probe ? '#e2e8f0' : probe.ok ? '#16a34a' : '#dc2626';
            const height = !probe ? 12 : Math.max(8, Math.min(60, probe.ms / 4));
            return (
              <div
                key={i}
                title={
                  probe
                    ? `${probe.ok ? 'OK' : 'FAIL'} — ${probe.ms} ms — ${new Date(probe.at).toLocaleTimeString()}`
                    : 'pending'
                }
                style={{ flex: 1, height: `${height}px`, backgroundColor: color, borderRadius: '2px' }}
              />
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
          <Stat label="Uptime (last 20)" value={uptimePct} />
          <Stat label="Last latency" value={last ? `${last.ms} ms` : '—'} />
          <Stat label="Polled every" value={`${POLL_MS / 1000}s`} />
        </div>

        {last && !last.ok && last.error && (
          <div
            role="alert"
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }}
          >
            {last.error}
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        This page polls <code>/api/health</code> from your browser. Numbers are independent of any third-party
        uptime service. Source of truth: {API_BASE}/health · {now ? new Date(now).toLocaleString() : '—'}
      </p>
    </MarketingShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>{value}</div>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginTop: '0.25rem'
        }}
      >
        {label}
      </div>
    </div>
  );
}
