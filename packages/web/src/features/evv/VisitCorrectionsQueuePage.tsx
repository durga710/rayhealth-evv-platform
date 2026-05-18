/**
 * Coordinator review queue for VMUR (Visit Maintenance Unlock Request) items.
 *
 * Consumes `GET /api/maintenance/queue`. Each row exposes Approve and Reject
 * controls that hit the corresponding POST endpoints. Approve optionally
 * accepts adjusted clock-in / clock-out timestamps; Reject requires a reason.
 *
 * Caregiver-originated corrections (visit-card → mobile app) land in the
 * same queue with `originatorRole = 'caregiver'`. Coordinator-filed
 * corrections still arrive here as `coordinator` / `admin` and can be
 * self-approved by an admin if they have schedule.write — the UI doesn't
 * enforce four-eyes; that's a policy decision the backend would gate.
 */

import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';

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

const REASON_CODE_LABELS: Record<string, string> = {
  MTLB: 'Mobile — no internet at start',
  DCDB: 'Device damaged / broken',
  MFLB: 'Manual entry — late',
  MFLA: 'Manual entry — added',
  ACLN: 'Client refused app',
  ATGL: 'GPS lookup failed',
  AGRS: 'Aggregator system issue',
  WKAP: 'Worker not available',
  CNCL: 'Visit cancelled',
  HOLI: 'Holiday adjustment',
  WKLI: 'Worker called in late',
  OTHR: 'Other',
};

const CORRECTION_CODE_LABELS: Record<string, string> = {
  TIME_CHANGE: 'Time changed',
  CAREGIVER_CHANGE: 'Caregiver changed',
  CLIENT_CHANGE: 'Client changed',
  TASK_CHANGE: 'Task changed',
  VISIT_ADDED: 'Visit added',
  VISIT_CANCELED: 'Visit canceled',
  VISIT_VERIFIED: 'Visit verified',
  OTHER: 'Other',
};

export function VisitCorrectionsQueuePage(): React.JSX.Element {
  const [items, setItems] = useState<VmurItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJson<ApiResponse<VmurItem[]>>('/api/maintenance/queue');
      if (response.success && response.data) {
        setItems(response.data);
      } else {
        setError(response.error ?? 'Failed to load corrections queue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load corrections queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flashToast = (message: string): void => {
    setToast(message);
    setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3500);
  };

  const handleApprove = async (
    id: string,
    args: { adjustedStartTime?: string; adjustedEndTime?: string },
  ): Promise<void> => {
    setActingId(id);
    setError(null);
    try {
      await postJson<ApiResponse<VmurItem>>(`/api/maintenance/approve-unlock/${id}`, args);
      flashToast('Correction approved.');
      await refresh();
    } catch (err) {
      if (err instanceof HttpError) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? `Approve failed (HTTP ${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Approve failed');
      }
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string, reason: string): Promise<void> => {
    setActingId(id);
    setError(null);
    try {
      await postJson<ApiResponse<VmurItem>>(`/api/maintenance/reject-unlock/${id}`, { reason });
      flashToast('Correction rejected.');
      await refresh();
    } catch (err) {
      if (err instanceof HttpError) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? `Reject failed (HTTP ${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Reject failed');
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Visit corrections review</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
          Pending VMUR submissions awaiting coordinator review. Caregiver-filed corrections
          from the mobile app land here alongside coordinator-filed ones.
        </p>
      </header>

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not complete the request.</strong> {error}
        </div>
      )}

      {toast && (
        <div role="status" style={toastStyle}>{toast}</div>
      )}

      {loading && <p>Loading queue…</p>}

      {!loading && items.length === 0 && (
        <div style={emptyStateStyle}>
          <strong>Queue is clear.</strong>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
            No pending visit corrections for your agency right now.
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {items.map((item) => (
            <CorrectionRow
              key={item.id ?? item.visitId}
              item={item}
              acting={actingId === item.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Row -----

interface CorrectionRowProps {
  item: VmurItem;
  acting: boolean;
  onApprove: (id: string, args: { adjustedStartTime?: string; adjustedEndTime?: string }) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

function CorrectionRow({ item, acting, onApprove, onReject }: CorrectionRowProps): React.JSX.Element {
  const [adjustedStart, setAdjustedStart] = useState(item.adjustedStartTime ?? '');
  const [adjustedEnd, setAdjustedEnd] = useState(item.adjustedEndTime ?? '');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const id = item.id ?? '';
  const reasonLabel = item.reasonCategoryCode
    ? `${item.reasonCategoryCode} — ${REASON_CODE_LABELS[item.reasonCategoryCode] ?? 'unknown reason code'}`
    : 'No reason code on file';
  const correctionLabel = item.correctionCode
    ? `${item.correctionCode} — ${CORRECTION_CODE_LABELS[item.correctionCode] ?? 'unknown correction code'}`
    : 'No correction code on file';

  const submitApprove = (e: FormEvent): void => {
    e.preventDefault();
    if (!id) return;
    void onApprove(id, {
      adjustedStartTime: adjustedStart.trim() || undefined,
      adjustedEndTime: adjustedEnd.trim() || undefined,
    });
  };

  const submitReject = (e: FormEvent): void => {
    e.preventDefault();
    if (!id) return;
    if (!rejectReason.trim()) return;
    void onReject(id, rejectReason.trim());
  };

  return (
    <div style={rowCardStyle}>
      <div style={rowHeaderStyle}>
        <div>
          <div style={{ fontWeight: 600 }}>
            Visit <code style={codeStyle}>{item.visitId}</code>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.1rem' }}>
            Originator: <strong>{item.originatorRole ?? 'unknown'}</strong>
            {' · Requested by '}
            <code style={codeStyle}>{item.requesterId}</code>
          </div>
        </div>
        <span style={pendingBadgeStyle}>Pending</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
        <Field label="Reason">{reasonLabel}</Field>
        <Field label="Correction">{correctionLabel}</Field>
        {item.originalStartTime && (
          <Field label="Original start">{formatTimestamp(item.originalStartTime)}</Field>
        )}
        {item.originalEndTime && (
          <Field label="Original end">{formatTimestamp(item.originalEndTime)}</Field>
        )}
        {item.adjustedStartTime && (
          <Field label="Proposed start">{formatTimestamp(item.adjustedStartTime)}</Field>
        )}
        {item.adjustedEndTime && (
          <Field label="Proposed end">{formatTimestamp(item.adjustedEndTime)}</Field>
        )}
      </div>

      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
        <strong>Notes:</strong> {item.reason}
      </div>

      <SignatureBlock item={item} />

      {!rejectMode ? (
        <form onSubmit={submitApprove} style={{ marginTop: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Adjusted start (ISO, optional)</span>
              <input
                type="text"
                value={adjustedStart}
                onChange={(e) => setAdjustedStart(e.target.value)}
                placeholder="2026-05-10T09:00:00.000Z"
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Adjusted end (ISO, optional)</span>
              <input
                type="text"
                value={adjustedEnd}
                onChange={(e) => setAdjustedEnd(e.target.value)}
                placeholder="2026-05-10T17:30:00.000Z"
                style={inputStyle}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="submit" disabled={acting} style={approveButtonStyle}>
              {acting ? 'Approving…' : 'Approve correction'}
            </button>
            <button
              type="button"
              onClick={() => setRejectMode(true)}
              disabled={acting}
              style={rejectButtonStyle}
            >
              Reject…
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitReject} style={{ marginTop: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Rejection reason (required)</span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder="e.g. insufficient documentation — please re-file with the visit logs attached."
              style={{ ...inputStyle, resize: 'vertical' }}
              required
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" disabled={acting || !rejectReason.trim()} style={rejectButtonStyle}>
              {acting ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              onClick={() => setRejectMode(false)}
              disabled={acting}
              style={cancelButtonStyle}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ----- Sub-components -----

interface SignatureBlockProps {
  item: VmurItem;
}
function SignatureBlock({ item }: SignatureBlockProps): React.JSX.Element | null {
  // Only render when signature status is explicitly set on the row —
  // older rows pre-VMUR-upgrade won't have these fields populated.
  if (
    item.caregiverSignaturePresent === undefined &&
    item.clientSignaturePresent === undefined &&
    !item.incompleteSignatureReason
  ) {
    return null;
  }

  const cg = item.caregiverSignaturePresent;
  const cl = item.clientSignaturePresent;

  return (
    <div style={signatureBlockStyle}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Signatures</div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
        <SigPill label="Caregiver" present={cg} />
        <SigPill label="Client" present={cl} />
      </div>
      {item.incompleteSignatureReason && (
        <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
          <strong>Justification:</strong> {item.incompleteSignatureReason}
        </div>
      )}
    </div>
  );
}

interface SigPillProps {
  label: string;
  present?: boolean;
}
function SigPill({ label, present }: SigPillProps): React.JSX.Element {
  if (present === undefined) {
    return <span style={sigPillStyle('#e2e8f0', '#334155')}>{label}: unknown</span>;
  }
  if (present) {
    return <span style={sigPillStyle('#dcfce7', '#166534')}>{label}: ✓ present</span>;
  }
  return <span style={sigPillStyle('#fee2e2', '#991b1b')}>{label}: ✗ missing</span>;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', marginTop: '0.1rem' }}>{children}</div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ----- Styles (kept inline to match the surrounding pages' convention) -----

const rowCardStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
};

const rowHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
};

const pendingBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  backgroundColor: '#FEF3C7',
  color: '#92400E',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.55rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontFamily: 'SF Mono, Menlo, monospace',
};

const approveButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#0B5FB1',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 500,
  cursor: 'pointer',
};

const rejectButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#fff',
  color: '#b91c1c',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  fontWeight: 500,
  cursor: 'pointer',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#fff',
  color: '#475569',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontWeight: 500,
  cursor: 'pointer',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  marginBottom: '1rem',
};

const toastStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  backgroundColor: '#dcfce7',
  color: '#166534',
  borderRadius: '6px',
  marginBottom: '1rem',
  fontSize: '0.9rem',
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
  fontSize: '0.8rem',
  backgroundColor: '#f1f5f9',
  padding: '0 0.25rem',
  borderRadius: '4px',
};

const signatureBlockStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.6rem 0.75rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
};

const sigPillStyle = (bg: string, fg: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: fg,
  padding: '0.15rem 0.5rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  fontWeight: 500,
});
