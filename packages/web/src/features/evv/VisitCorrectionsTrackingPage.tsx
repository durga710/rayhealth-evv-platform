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
import { History, Filter } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import { PageHeader } from '@/components/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <PageHeader
        title="Visit corrections tracking"
        description="Full history of VMUR corrections for your agency — every status, every originator. Read-only. Pending items can be approved or rejected from the Corrections Queue page."
      />

      <FilterBar filters={filters} onChange={updateFilter} />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not load history.</strong> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden />
            Corrections History
          </CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? 'correction' : 'corrections'} matching the current filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : items.length === 0 ? (
            <EmptyState message="No corrections match the current filters." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Status</TableHead>
                    <TableHead>Originator</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Correction</TableHead>
                    <TableHead>Signatures</TableHead>
                    <TableHead>Filed by</TableHead>
                    <TableHead>Approved by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <Row key={item.id ?? item.visitId} item={item} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="size-5 text-primary" aria-hidden />
          Filters
        </CardTitle>
        <CardDescription>Narrow the history by status, originator, or reason code.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(e) => onChange('status', e.target.value as Filters['status'])}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-originator">Originator</Label>
            <Select
              id="filter-originator"
              value={filters.originator}
              onChange={(e) => onChange('originator', e.target.value as Filters['originator'])}
            >
              <option value="">All</option>
              <option value="caregiver">Caregiver</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-reason">Reason code</Label>
            <Select
              id="filter-reason"
              value={filters.reasonCode}
              onChange={(e) => onChange('reasonCode', e.target.value)}
            >
              <option value="">All</option>
              {REASON_CODES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Row -----

interface RowProps {
  item: VmurItem;
}
function Row({ item }: RowProps): React.JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <StatusBadge status={item.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">{item.originatorRole ?? '—'}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{item.visitId.slice(0, 8)}…</code>
      </TableCell>
      <TableCell>{item.reasonCategoryCode ?? '—'}</TableCell>
      <TableCell>{item.correctionCode ?? '—'}</TableCell>
      <TableCell>
        <SignaturePair
          caregiver={item.caregiverSignaturePresent}
          client={item.clientSignaturePresent}
        />
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{item.requesterId.slice(0, 8)}…</code>
      </TableCell>
      <TableCell>
        {item.approverId ? (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{item.approverId.slice(0, 8)}…</code>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}

interface StatusBadgeProps {
  status: VmurStatus;
}
function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  if (status === 'approved') return <Badge variant="success">Approved</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

interface SignaturePairProps {
  caregiver?: boolean;
  client?: boolean;
}
function SignaturePair({ caregiver, client }: SignaturePairProps): React.JSX.Element {
  return (
    <span className="inline-flex gap-1.5">
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
    return <Badge variant="secondary">{label}?</Badge>;
  }
  if (present) return <Badge variant="success">{label} ✓</Badge>;
  return <Badge variant="destructive">{label} ✗</Badge>;
}

// ----- Empty state -----

function EmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <History className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
