import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson, HttpError, postJson } from '../../lib/api-client.js';

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
      <h2>Caregiver Assignments</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Schedule and assign caregivers to client visits.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>New Assignment</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={fieldStyle}>
              <label htmlFor="clientId">Client</label>
              {clients.length > 0 ? (
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
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
                </select>
              ) : (
                <input id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" required />
              )}
            </div>

            <div style={{ ...fieldStyle, marginTop: '1rem' }}>
              <label htmlFor="caregiverPicker">Caregiver</label>
              {caregivers.length > 0 ? (
                <select
                  id="caregiverPicker"
                  value={caregiverId}
                  onChange={(e) => setCaregiverId(e.target.value)}
                  required
                  style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
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
                </select>
              ) : (
                <input
                  id="caregiverPicker"
                  value={caregiverId}
                  onChange={(e) => setCaregiverId(e.target.value)}
                  placeholder="Caregiver ID"
                  required
                />
              )}
              {preflightLoading && (
                <span style={preflightHintStyle}>Checking training compliance…</span>
              )}
              {!preflightLoading && preflight && preflight.compliant && (
                <span style={{ ...preflightHintStyle, color: '#085041' }}>
                  ✓ Caregiver is training-compliant
                </span>
              )}
              {!preflightLoading && preflight && !preflight.compliant && (
                <span style={{ ...preflightHintStyle, color: '#791F1F' }}>
                  ⚠ {preflight.blockers.length} training blocker{preflight.blockers.length === 1 ? '' : 's'} — submit will require override
                </span>
              )}
            </div>

            <div style={{ ...fieldStyle, marginTop: '1rem' }}>
              <label htmlFor="templateId">Visit Template</label>
              <select
                id="templateId"
                value={visitTemplateId}
                onChange={(e) => setVisitTemplateId(e.target.value)}
                required
                style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {displayClient(t.clientId)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...fieldStyle, marginTop: '1rem' }}>
              <label htmlFor="visitDate">Visit Date</label>
              <input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>

            <button type="submit" disabled={submitting} aria-busy={submitting} style={{ marginTop: '1rem' }}>
              {submitting ? 'Creating…' : 'Create Assignment'}
            </button>
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
              style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: message.kind === 'error' ? '#fef2f2' : '#ecfdf5',
                color: message.kind === 'error' ? '#991b1b' : '#065f46',
                borderRadius: '8px',
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        <div>
          <h3>Upcoming Assignments</h3>
          {assignments.length === 0 ? (
            <div style={emptyAssignmentsStyle}>No assignments found.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assignments.map((a) => (
                <li key={a.id} style={assignmentRowStyle}>
                  <div>
                    <strong>{displayCaregiver(a.caregiverId)}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      Client: {displayClient(a.clientId)}
                    </div>
                  </div>
                  {a.visitDate && (
                    <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', color: '#047857', borderRadius: '4px' }}>
                      Date: {a.visitDate}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
    <div role="alert" style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <strong style={{ color: '#791F1F' }}>Caregiver not training-compliant</strong>
        <span style={{ fontSize: '0.8rem', color: '#791F1F', opacity: 0.85 }}>
          {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul style={{ margin: '0 0 0.75rem', padding: '0 0 0 1.2rem', fontSize: '0.9rem', color: '#791F1F' }}>
        {blockers.map((b) => (
          <li key={b.enrollmentId}>
            <strong>{b.courseTitle}</strong> ({b.courseCode}) — {b.reason}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link to={`/admin/learning/caregivers/${caregiverId}`} style={resolveLinkStyle}>
          Resolve training →
        </Link>
        <button
          type="button"
          onClick={() => void onOverride()}
          disabled={submitting}
          aria-busy={submitting}
          style={overrideButtonStyle}
        >
          Override (record reason)
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} style={cancelButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const emptyAssignmentsStyle: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  color: '#64748b',
  marginTop: '1rem',
};

const assignmentRowStyle: React.CSSProperties = {
  padding: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const bannerStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '1rem 1.25rem',
  backgroundColor: '#FCEBEB',
  borderLeft: '4px solid #E24B4A',
  borderRadius: '8px',
};

const resolveLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  backgroundColor: '#791F1F',
  color: '#ffffff',
  padding: '0.5rem 0.85rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const overrideButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#791F1F',
  border: '1px solid #791F1F',
  padding: '0.5rem 0.85rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const cancelButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '0.5rem 0.85rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const preflightHintStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-muted)',
  marginTop: '0.25rem',
};
