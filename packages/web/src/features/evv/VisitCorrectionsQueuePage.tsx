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
import { ClipboardCheck, Inbox } from 'lucide-react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
      <PageHeader
        title="Visit corrections review"
        description="Pending VMUR submissions awaiting coordinator review. Caregiver-filed corrections from the mobile app land here alongside coordinator-filed ones."
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not complete the request.</strong> {error}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {toast}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" aria-hidden />
            Pending corrections
          </CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? 'correction' : 'corrections'} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading queue…</p>
          ) : items.length === 0 ? (
            <EmptyState message="Queue is clear. No pending visit corrections for your agency right now." />
          ) : (
            <div className="flex flex-col gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
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
  const startInputId = `adjusted-start-${id || item.visitId}`;
  const endInputId = `adjusted-end-${id || item.visitId}`;
  const reasonInputId = `reject-reason-${id || item.visitId}`;
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
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              Visit <code className="rounded bg-muted px-1 font-mono text-xs">{item.visitId}</code>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              Originator: <strong>{item.originatorRole ?? 'unknown'}</strong>
              {' · Requested by '}
              <code className="rounded bg-muted px-1 font-mono text-xs">{item.requesterId}</code>
            </div>
          </div>
          <Badge variant="warning" className="uppercase">Pending</Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
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

        <div className="mt-3 text-sm">
          <strong>Notes:</strong> {item.reason}
        </div>

        <SignatureBlock item={item} />

        {!rejectMode ? (
          <form onSubmit={submitApprove} className="mt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={startInputId}>Adjusted start (ISO, optional)</Label>
                <Input
                  id={startInputId}
                  type="text"
                  value={adjustedStart}
                  onChange={(e) => setAdjustedStart(e.target.value)}
                  placeholder="2026-05-10T09:00:00.000Z"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={endInputId}>Adjusted end (ISO, optional)</Label>
                <Input
                  id={endInputId}
                  type="text"
                  value={adjustedEnd}
                  onChange={(e) => setAdjustedEnd(e.target.value)}
                  placeholder="2026-05-10T17:30:00.000Z"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={acting} aria-busy={acting}>
                {acting ? 'Approving…' : 'Approve correction'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectMode(true)}
                disabled={acting}
              >
                Reject…
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitReject} className="mt-4">
            <div className="space-y-1.5">
              <Label htmlFor={reasonInputId}>Rejection reason (required)</Label>
              <textarea
                id={reasonInputId}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder="e.g. insufficient documentation — please re-file with the visit logs attached."
                className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" variant="destructive" disabled={acting || !rejectReason.trim()} aria-busy={acting}>
                {acting ? 'Rejecting…' : 'Confirm rejection'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRejectMode(false)}
                disabled={acting}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
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
    <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="text-xs font-semibold text-muted-foreground">Signatures</div>
      <div className="mt-1 flex gap-3 text-sm">
        <SigPill label="Caregiver" present={cg} />
        <SigPill label="Client" present={cl} />
      </div>
      {item.incompleteSignatureReason && (
        <div className="mt-1.5 text-sm">
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
    return <Badge variant="secondary">{label}: unknown</Badge>;
  }
  if (present) {
    return <Badge variant="success">{label}: ✓ present</Badge>;
  }
  return <Badge variant="destructive">{label}: ✗ missing</Badge>;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
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
