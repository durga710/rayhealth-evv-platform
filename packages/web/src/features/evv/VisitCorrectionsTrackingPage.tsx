/**
 * Visit corrections tracking page.
 *
 * Per the user-stated requirement: "a dedicated tracking page" for missed
 * punch / VMUR corrections, distinct from the coordinator review queue.
 *
 * Differences from `VisitCorrectionsQueuePage`:
 *   - This page lists every status (pending, approved, rejected), not just pending.
 *   - It's read-only. No approve/reject controls — those live on the queue page.
 *   - Supports filter by status, originator, and reason category code.
 *   - Drives off `GET /api/maintenance/history` (new endpoint, capped at 500 rows).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';

type VmurStatus = 'pending' | 'approved' | 'rejected';
type VmurOriginator = 'caregiver' | 'coordinator' | 'admin';

interface VmurItem {
  id?: string;
  visitId: string;
  agencyId?: string;
  requesterId: string;
  reason: string;
  reasonCategoryCode?: string;
  correctionCode?: string;
  originatorRole?: VmurOriginator;
  originalStartTime?: string;
  originalEndTime?: string;
  adjustedStartTime?: string;
  adjustedEndTime?: string;
  caregiverSignaturePresent?: boolean;
  clientSignaturePresent?: boolean;
  incompleteSignatureReason?: string;
  status: VmurStatus;
  approverId?: string;
  approvedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Filters {
  status: '' | VmurStatus;
  originator: '' | VmurOriginator;
  reasonCode: string;
}

const REASON_CODES = [
  'MTLB', 'DCDB', 'MFLB', 'MFLA', 'ACLN', 'ATGL',
  'AGRS', 'WKAP', 'CNCL', 'HOLI', 'WKLI', 'OTHR',
];

export function VisitCorrectionsTrackingPage(): React.JSX.Element {
  const [items, setItems] = useState<VmurItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: '', originator: '', reasonCode: '' });

  const refresh = useCallback(async (active: Filters): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (active.status) params.set('status', active.status);
      if (active.originator) params.set('originator', active.originator);
      if (active.reasonCode) params.set('reasonCode', active.reasonCode);
      const qs = params.toString();
      const url = qs ? `/api/maintenance/history?${qs}` : '/api/maintenance/history';
      const response = await getJson<ApiResponse<VmurItem[]>>(url);
      if (response.success && response.data) {
        setItems(response.data);
      } else {
        setError(response.error ?? 'Failed to load corrections history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load corrections history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(filters);
  }, [refresh, filters]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <header style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Visit corrections tracking</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
          Full history of VMUR corrections for your agency — every status, every originator.
          Read-only. Pending items can be approved or rejected from the Corrections Queue page.
        </p>
      </header>

      <FilterBar filters={filters} onChange={updateFilter} />

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not load history.</strong> {error}
        </div>
      )}

      {loading && <p>Loading history…</p>}

      {!loading && items.length === 0 && (
        <div style={emptyStateStyle}>
          <strong>No corrections match the current filters.</strong>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Originator</Th>
                <Th>Visit</Th>
                <Th>Reason</Th>
                <Th>Correction</Th>
                <Th>Signatures</Th>
                <Th>Filed by</Th>
                <Th>Approved by</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Row key={item.id ?? item.visitId} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----- Filter bar -----

interface FilterBarProps {
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}
function FilterBar({ filters, onChange }: FilterBarProps): React.JSX.Element {
  return (
    <div style={filterBarStyle}>
      <label style={filterLabelStyle}>
        <span style={filterLegendStyle}>Status</span>
        <select
          value={filters.status}
          onChange={(e) => onChange('status', e.target.value as Filters['status'])}
          style={selectStyle}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label style={filterLabelStyle}>
        <span style={filterLegendStyle}>Originator</span>
        <select
          value={filters.originator}
          onChange={(e) => onChange('originator', e.target.value as Filters['originator'])}
          style={selectStyle}
        >
          <option value="">All</option>
          <option value="caregiver">Caregiver</option>
          <option value="coordinator">Coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label style={filterLabelStyle}>
        <span style={filterLegendStyle}>Reason code</span>
        <select
          value={filters.reasonCode}
          onChange={(e) => onChange('reasonCode', e.target.value)}
          style={selectStyle}
        >
          <option value="">All</option>
          {REASON_CODES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ----- Row -----

interface RowProps {
  item: VmurItem;
}
function Row({ item }: RowProps): React.JSX.Element {
  return (
    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
      <Td>
        <StatusBadge status={item.status} />
      </Td>
      <Td>{item.originatorRole ?? '—'}</Td>
      <Td><code style={codeStyle}>{item.visitId.slice(0, 8)}…</code></Td>
      <Td>{item.reasonCategoryCode ?? '—'}</Td>
      <Td>{item.correctionCode ?? '—'}</Td>
      <Td>
        <SignaturePair
          caregiver={item.caregiverSignaturePresent}
          client={item.clientSignaturePresent}
        />
      </Td>
      <Td><code style={codeStyle}>{item.requesterId.slice(0, 8)}…</code></Td>
      <Td>
        {item.approverId
          ? <code style={codeStyle}>{item.approverId.slice(0, 8)}…</code>
          : '—'}
      </Td>
    </tr>
  );
}

interface StatusBadgeProps {
  status: VmurStatus;
}
function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  if (status === 'approved') return <span style={badgeStyle('#dcfce7', '#166534')}>Approved</span>;
  if (status === 'rejected') return <span style={badgeStyle('#fee2e2', '#991b1b')}>Rejected</span>;
  return <span style={badgeStyle('#FEF3C7', '#92400E')}>Pending</span>;
}

interface SignaturePairProps {
  caregiver?: boolean;
  client?: boolean;
}
function SignaturePair({ caregiver, client }: SignaturePairProps): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', fontSize: '0.78rem' }}>
      <SigDot label="CG" present={caregiver} />
      <SigDot label="CL" present={client} />
    </span>
  );
}

interface SigDotProps {
  label: string;
  present?: boolean;
}
function SigDot({ label, present }: SigDotProps): React.JSX.Element {
  if (present === undefined) {
    return <span style={badgeStyle('#e2e8f0', '#475569')}>{label}?</span>;
  }
  if (present) return <span style={badgeStyle('#dcfce7', '#166534')}>{label} ✓</span>;
  return <span style={badgeStyle('#fee2e2', '#991b1b')}>{label} ✗</span>;
}

// ----- Small helpers -----

interface ThProps {
  children: React.ReactNode;
}
function Th({ children }: ThProps): React.JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '0.5rem 0.75rem',
      fontSize: '0.75rem',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '1px solid #cbd5e1',
    }}>
      {children}
    </th>
  );
}

interface TdProps {
  children: React.ReactNode;
}
function Td({ children }: TdProps): React.JSX.Element {
  return (
    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

// ----- Styles -----

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
  padding: '0.75rem 1rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
};

const filterLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};

const filterLegendStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const selectStyle: React.CSSProperties = {
  padding: '0.4rem 0.55rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  backgroundColor: '#fff',
  fontSize: '0.85rem',
  minWidth: '8rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  marginBottom: '1rem',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '1.5rem',
  border: '1px dashed #cbd5e1',
  borderRadius: '12px',
  textAlign: 'center',
  color: '#475569',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'SF Mono, Menlo, monospace',
  fontSize: '0.78rem',
  backgroundColor: '#f1f5f9',
  padding: '0 0.25rem',
  borderRadius: '4px',
};

const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  backgroundColor: bg,
  color: fg,
  padding: '0.15rem 0.5rem',
  borderRadius: '999px',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
});
