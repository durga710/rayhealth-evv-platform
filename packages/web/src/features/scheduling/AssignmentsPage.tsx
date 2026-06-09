import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarClock, Search, ShieldAlert } from 'lucide-react';
import { getJson, HttpError, postJson } from '../../lib/api-client.js';
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

interface Template {
  id: string;
  name: string;
  clientId: string;
}

interface CaregiverSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface StaffResponse {
  success: boolean;
  data?: CaregiverSummary[];
  error?: string;
}

interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  medicaidNumber?: string | null;
}

interface Assignment {
  id: string;
  clientId: string;
  caregiverId: string;
  visitDate?: string;
  visitTemplateId: string;
}

interface ComplianceBlocker {
  enrollmentId: string;
  courseCode: string;
  courseTitle: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
  reason: string;
}

interface ComplianceErrorBody {
  code?: string;
  message?: string;
  blockers?: ComplianceBlocker[];
}

interface AssignmentDraft {
  clientId: string;
  caregiverId: string;
  visitTemplateId: string;
  visitDate: string;
}

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverSummary[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);

  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [visitTemplateId, setVisitTemplateId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  // Compliance-gate state
  const [blockers, setBlockers] = useState<ComplianceBlocker[]>([]);
  const [blockedDraft, setBlockedDraft] = useState<AssignmentDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preflight compliance state — checked as the coordinator types the caregiver ID
  const [preflight, setPreflight] = useState<{ compliant: boolean; blockers: ComplianceBlocker[] } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Debounced preflight check: 600ms after the caregiverId stops changing,
  // hit /api/assignments/compliance-check/:caregiverId so coordinators see
  // the compliance state up front instead of hitting a 422 after submitting.
  useEffect(() => {
    if (!caregiverId || caregiverId.length < 8) {
      setPreflight(null);
      return;
    }
    const handle = setTimeout(() => {
      void (async () => {
        setPreflightLoading(true);
        try {
          const response = await getJson<{ success: boolean; data?: { compliant: boolean; blockers: ComplianceBlocker[] }; error?: string }>(
            `/api/assignments/compliance-check/${caregiverId}`,
          );
          if (response.success && response.data) {
            setPreflight(response.data);
          } else {
            setPreflight(null);
          }
        } catch {
          // Silent — preflight is a helpful hint, not a hard requirement.
          // The 422 gate still fires on submit if something's wrong.
          setPreflight(null);
        } finally {
          setPreflightLoading(false);
        }
      })();
    }, 600);
    return () => clearTimeout(handle);
  }, [caregiverId]);

  useEffect(() => {
    getJson<Assignment[]>('/api/assignments')
      .then((data) => setAssignments(data || []))
      .catch(() => {
        /* surfaced via individual create attempts; the list endpoint is read-only */
      });

    getJson<Template[]>('/api/templates')
      .then((data) => setTemplates(data || []))
      .catch(() => {
        /* same */
      });

    getJson<StaffResponse>('/api/staff')
      .then((response) => {
        if (response?.success && Array.isArray(response.data)) {
          setCaregivers(response.data);
        }
      })
      .catch(() => {
        /* name lookup is a convenience; ID slices still render below */
      });

    getJson<ClientSummary[]>('/api/clients')
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {
        /* same — client name lookup is a convenience */
      });
  }, []);

  // Map of caregiverId → "First Last" for inline name display. Falls back to
  // a slice of the ID when the caregiver isn't in the staff list (deleted,
  // not yet synced, etc.).
  const caregiverNameById = caregivers.reduce<Record<string, string>>((map, c) => {
    map[c.id] = `${c.firstName} ${c.lastName}`;
    return map;
  }, {});

  const displayCaregiver = (id: string): string => {
    return caregiverNameById[id] ?? `${id.slice(0, 6)}…`;
  };

  const clientNameById = clients.reduce<Record<string, string>>((map, c) => {
    map[c.id] = `${c.lastName}, ${c.firstName}`;
    return map;
  }, {});

  const displayClient = (id: string): string => {
    return clientNameById[id] ?? `${id.slice(0, 6)}…`;
  };

  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      `${displayCaregiver(a.caregiverId)} ${displayClient(a.clientId)} ${a.visitDate ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [assignments, query, caregiverNameById, clientNameById]);

  const resetForm = (): void => {
    setClientId('');
    setCaregiverId('');
    setVisitTemplateId('');
    setVisitDate('');
  };

  const submitAssignment = async (
    draft: AssignmentDraft,
    options: { force?: boolean; overrideReason?: string } = {},
  ): Promise<void> => {
    setMessage(null);
    setSubmitting(true);
    try {
      const payload = options.force
        ? { ...draft, force: true, overrideReason: options.overrideReason ?? '' }
        : draft;
      const newAssign = await postJson<Assignment>('/api/assignments', payload);
      setAssignments((prev) => [...prev, newAssign]);
      resetForm();
      setBlockers([]);
      setBlockedDraft(null);
      setMessage({
        kind: 'success',
        text: options.force
          ? 'Assignment created with training-override on file'
          : 'Assignment created successfully',
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as ComplianceErrorBody | null;
        if (body?.code === 'CAREGIVER_NOT_COMPLIANT' && body.blockers) {
          setBlockers(body.blockers);
          setBlockedDraft(draft);
          setMessage(null);
          return;
        }
      }
      setMessage({ kind: 'error', text: 'Failed to create assignment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await submitAssignment({ clientId, caregiverId, visitTemplateId, visitDate });
  };

  const handleOverride = async (): Promise<void> => {
    if (!blockedDraft) return;
    const reason = window.prompt(
      'Record why this assignment is being made despite incomplete training.\n\n' +
        'This reason is written to the agency audit log alongside the assignment.',
    );
    if (!reason || !reason.trim()) {
      setMessage({ kind: 'error', text: 'Override requires a reason' });
      return;
    }
    await submitAssignment(blockedDraft, { force: true, overrideReason: reason.trim() });
  };

  const handleClearBlockers = (): void => {
    setBlockers([]);
    setBlockedDraft(null);
  };

  return (
    <div>
      <PageHeader
        title="Caregiver Assignments"
        description="Schedule and assign caregivers to client visits."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-primary" aria-hidden />
              New Assignment
            </CardTitle>
            <CardDescription>Assign a caregiver to a client visit template.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client</Label>
                {clients.length > 0 ? (
                  <Select
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">Select a client</option>
                    {clients
                      .slice()
                      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.lastName}, {c.firstName}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Client ID"
                    required
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="caregiverPicker">Caregiver</Label>
                {caregivers.length > 0 ? (
                  <Select
                    id="caregiverPicker"
                    value={caregiverId}
                    onChange={(e) => setCaregiverId(e.target.value)}
                    required
                  >
                    <option value="">Select a caregiver</option>
                    {caregivers
                      .filter((c) => c.status === 'active')
                      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.lastName}, {c.firstName} · {c.email}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    id="caregiverPicker"
                    value={caregiverId}
                    onChange={(e) => setCaregiverId(e.target.value)}
                    placeholder="Caregiver ID"
                    required
                  />
                )}
                {preflightLoading && (
                  <span className="text-xs text-muted-foreground">Checking training compliance…</span>
                )}
                {!preflightLoading && preflight && preflight.compliant && (
                  <span className="text-xs text-emerald-700">✓ Caregiver is training-compliant</span>
                )}
                {!preflightLoading && preflight && !preflight.compliant && (
                  <span className="text-xs text-destructive">
                    ⚠ {preflight.blockers.length} training blocker{preflight.blockers.length === 1 ? '' : 's'} — submit will require override
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="templateId">Visit Template</Label>
                <Select
                  id="templateId"
                  value={visitTemplateId}
                  onChange={(e) => setVisitTemplateId(e.target.value)}
                  required
                >
                  <option value="">Select a template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {displayClient(t.clientId)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="visitDate">Visit Date</Label>
                <Input
                  id="visitDate"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? 'Creating…' : 'Create Assignment'}
              </Button>
            </form>

            {blockers.length > 0 && blockedDraft && (
              <ComplianceBlockerBanner
                blockers={blockers}
                caregiverId={blockedDraft.caregiverId}
                onOverride={handleOverride}
                onCancel={handleClearBlockers}
                submitting={submitting}
              />
            )}

            {message && (
              <div
                role={message.kind === 'error' ? 'alert' : 'status'}
                className={
                  message.kind === 'error'
                    ? 'mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                    : 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                }
              >
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" aria-hidden />
                Upcoming Assignments
              </CardTitle>
              <CardDescription>
                {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-56">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assignments…"
                className="pl-9"
                aria-label="Search assignments"
              />
            </div>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <EmptyState message="No assignments found." />
            ) : filteredAssignments.length === 0 ? (
              <EmptyState message={`No assignments match “${query}”.`} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Caregiver</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{displayCaregiver(a.caregiverId)}</TableCell>
                        <TableCell className="text-muted-foreground">{displayClient(a.clientId)}</TableCell>
                        <TableCell className="text-right">
                          {a.visitDate ? (
                            <Badge variant="secondary">{a.visitDate}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

interface ComplianceBlockerBannerProps {
  blockers: ComplianceBlocker[];
  caregiverId: string;
  onOverride: () => void | Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function ComplianceBlockerBanner({
  blockers,
  caregiverId,
  onOverride,
  onCancel,
  submitting,
}: ComplianceBlockerBannerProps) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive"
    >
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="size-4" aria-hidden />
        <strong>Caregiver not training-compliant</strong>
        <Badge variant="destructive">
          {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
        </Badge>
      </div>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
        {blockers.map((b) => (
          <li key={b.enrollmentId}>
            <strong>{b.courseTitle}</strong> ({b.courseCode}) — {b.reason}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="destructive">
          <Link to={`/admin/learning/caregivers/${caregiverId}`}>Resolve training →</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onOverride()}
          disabled={submitting}
          aria-busy={submitting}
        >
          Override (record reason)
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <CalendarClock className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
