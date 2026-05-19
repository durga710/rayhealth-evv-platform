import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
}

type EmailDeliveryStatus = 'sent' | 'failed' | 'not_configured';

interface CreatedInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  acceptPath: string;
  emailDelivery?: EmailDeliveryStatus;
}

interface ResendResponse {
  id: string;
  email: string;
  emailDelivery: EmailDeliveryStatus;
  emailError?: string;
}

type ResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; reason: string };

export function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('caregiver');
  const [message, setMessage] = useState('');
  // Last successfully-created invite. Surfaced prominently so the admin
  // can copy the URL as a fallback when email delivery isn't configured
  // or fails.
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-row resend state — keyed by invite id so multiple rows don't
  // share a single "sending" indicator.
  const [resendState, setResendState] = useState<Record<string, ResendState>>({});

  const loadStaff = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<StaffMember[]>('/api/staff')
      .then(data => setStaff(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load staff'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const focusInvite = () => {
    document.getElementById('email')?.focus();
  };

  const fillSampleData = () => {
    setEmail('caregiver+sample@rayhealth.test');
    setRole('caregiver');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setCreatedInvite(null);
    setCopied(false);
    try {
      const invite = await postJson<CreatedInvite>('/api/invites', { email, role });
      setStaff(prev => [...prev, { id: invite.id, email: invite.email, role: invite.role, status: invite.status }]);
      setCreatedInvite(invite);
      // Different copy depending on whether email delivery actually
      // succeeded. `'sent'` means Resend accepted the message — we
      // celebrate that path. Everything else falls back to the
      // copy-and-share UX, same as before email delivery existed.
      if (invite.emailDelivery === 'sent') {
        setMessage(
          `We've emailed the invitation to ${email}. They'll click the link to set their password. ` +
          `(If they don't get it, copy the link below as a fallback.)`
        );
      } else {
        setMessage(`Invite created for ${email} — copy the link below and share it with them.`);
      }
      setEmail('');
    } catch {
      setMessage('Failed to create invite');
    }
  };

  const handleResend = async (inviteId: string) => {
    setResendState(prev => ({ ...prev, [inviteId]: { status: 'sending' } }));
    try {
      const result = await postJson<ResendResponse>(
        `/api/invites/${encodeURIComponent(inviteId)}/resend-email`,
        {}
      );
      if (result.emailDelivery === 'sent') {
        setResendState(prev => ({ ...prev, [inviteId]: { status: 'sent' } }));
        // Auto-clear after a few seconds so the button is reusable.
        setTimeout(() => {
          setResendState(prev => {
            const next = { ...prev };
            delete next[inviteId];
            return next;
          });
        }, 4000);
      } else if (result.emailDelivery === 'not_configured') {
        setResendState(prev => ({
          ...prev,
          [inviteId]: { status: 'failed', reason: 'Email not configured on server' }
        }));
      } else {
        const reason = result.emailError
          ? `Send failed: ${result.emailError}`
          : 'Send failed — try again later';
        setResendState(prev => ({
          ...prev,
          [inviteId]: { status: 'failed', reason }
        }));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Request failed';
      setResendState(prev => ({
        ...prev,
        [inviteId]: { status: 'failed', reason }
      }));
    }
  };

  const inviteUrl = createdInvite
    ? `${window.location.origin}${createdInvite.acceptPath}`
    : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the text input so the user can Cmd-C manually.
      const el = document.getElementById('invite-url') as HTMLInputElement | null;
      el?.select();
    }
  };

  const activeStaff = staff.filter(s => s.status === 'active');
  const pendingInvites = staff.filter(s => s.status === 'pending');

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Staff</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Manage caregivers, coordinators, and invite new staff members.
          </p>
        </div>
        <button type="button" onClick={focusInvite} className="btn-primary">
          Invite staff
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 380px) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Invite a staff member</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                className="btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                Sample data
              </button>
            )}
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="email" className="label">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="staff@example.com"
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="role" className="label">Role</label>
              <select
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                className="select-field"
              >
                <option value="caregiver">Caregiver</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
              Create Invite
            </button>
          </form>
          {message && (
            <div
              className={`info-banner ${createdInvite ? 'banner-info' : 'banner-error'}`}
              style={{ marginTop: '1rem' }}
              role={createdInvite ? 'status' : 'alert'}
            >
              {message}
            </div>
          )}
          {createdInvite && inviteUrl && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                {createdInvite.emailDelivery === 'sent'
                  ? `Backup link — only needed if ${createdInvite.email} doesn't see the email.`
                  : `Share this link with ${createdInvite.email}. They'll set a password and finish creating their account.`}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input
                  id="invite-url"
                  type="text"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    backgroundColor: 'white'
                  }}
                />
                <button type="button" onClick={handleCopy} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                Expires {new Date(createdInvite.expiresAt).toLocaleString()} &middot; single-use
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* ── Active staff directory ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Active staff directory</h3>
              {!loading && !loadError && activeStaff.length > 0 && (
                <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{activeStaff.length} member{activeStaff.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {loading ? (
              <LoadingSkeleton rows={5} columns={3} />
            ) : loadError ? (
              <ErrorRetry message={loadError} onRetry={loadStaff} />
            ) : activeStaff.length === 0 ? (
              <EmptyState
                title="No active staff yet"
                body="Staff appear here once they accept their invite and set up their account."
                cta={{ label: 'Invite a staff member', onClick: focusInvite }}
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ width: '40px' }} aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {activeStaff.map((s) => {
                    const isExpanded = expandedId === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          style={{ cursor: 'pointer' }}
                          aria-expanded={isExpanded}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div
                                aria-hidden
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                                  color: 'white',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  flexShrink: 0,
                                }}
                              >
                                {s.email.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 500 }}>{s.email}</span>
                            </div>
                          </td>
                          <td style={{ textTransform: 'capitalize', color: '#475569' }}>{s.role}</td>
                          <td style={{ color: '#94A3B8' }}>{isExpanded ? '▾' : '▸'}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={3} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.25rem', fontSize: '0.8125rem', color: '#475569' }}>
                                <div style={{ fontWeight: 600 }}>User ID</div>
                                <div style={{ fontFamily: 'var(--font-mono)' }}>{s.id}</div>
                                <div style={{ fontWeight: 600 }}>Email</div>
                                <div>{s.email}</div>
                                <div style={{ fontWeight: 600 }}>Role</div>
                                <div style={{ textTransform: 'capitalize' }}>{s.role}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pending invitations ── only shown when invites exist ── */}
          {!loading && !loadError && pendingInvites.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Pending invitations</h3>
                <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{pendingInvites.length} awaiting acceptance</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ width: '140px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((s) => {
                    const resend = resendState[s.id] ?? { status: 'idle' as const };
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              aria-hidden
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: '#E2E8F0',
                                color: '#64748B',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                flexShrink: 0,
                              }}
                            >
                              {s.email.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500, color: '#64748B' }}>{s.email}</span>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', color: '#94A3B8' }}>{s.role}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <button
                              type="button"
                              onClick={() => handleResend(s.id)}
                              disabled={resend.status === 'sending'}
                              className={resend.status === 'sent' ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
                            >
                              {resend.status === 'sending' ? 'Resending…' : resend.status === 'sent' ? 'Sent' : 'Resend invite'}
                            </button>
                            {resend.status === 'failed' && (
                              <span style={{ fontSize: '0.75rem', color: '#BE123C' }}>{resend.reason}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
