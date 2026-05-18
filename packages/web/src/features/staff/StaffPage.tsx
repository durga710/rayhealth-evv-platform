import React, { useEffect, useState } from 'react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName?: string;
  lastName?: string;
}

interface InvitePublic {
  id: string;
  agencyId: string;
  email: string;
  role: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  lastSentAt: string | null;
  createdAt: string | null;
  acceptanceUrl: string;
}

interface InviteCreateResponse {
  success: boolean;
  data: InvitePublic;
  emailSent: boolean;
  error?: string;
}

export function StaffPage(): React.ReactElement {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState('caregiver');
  const [latestInvite, setLatestInvite] = useState<InvitePublic | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await getJson<StaffMember[]>('/api/staff');
        setStaff(Array.isArray(data) ? data : []);
      } catch {
        /* staff endpoint isn't critical for the invite flow */
      }
    };
    void load();
  }, []);

  const handleInvite = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLatestInvite(null);
    setEmailSent(null);
    setCopyState('idle');
    try {
      const response = await postJson<InviteCreateResponse>('/api/invites', {
        email,
        role,
        firstName: firstName || undefined,
      });
      if (!response.success || !response.data) {
        setError(response.error ?? 'Failed to create invite');
        return;
      }
      setLatestInvite(response.data);
      setEmailSent(response.emailSent);
      setStaff((prev) => [
        ...prev,
        { id: response.data.id, email: response.data.email, role: response.data.role, status: response.data.status },
      ]);
      setEmail('');
      setFirstName('');
    } catch (err) {
      if (err instanceof HttpError && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string };
        setError(body.error ?? `Request failed: ${err.status}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send invite');
      }
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!latestInvite) return;
    try {
      await navigator.clipboard.writeText(latestInvite.acceptanceUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      /* fallthrough: user can manually select */
    }
  };

  return (
    <div>
      <h2>Staff Management</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Manage caregivers, coordinators, and invite new staff members.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>Invite Staff Member</h3>
          <form onSubmit={(e) => void handleInvite(e)} style={{ marginTop: '1rem' }}>
            <div style={fieldStyle}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@example.com"
              />
            </div>

            <div style={{ ...fieldStyle, marginTop: '1rem' }}>
              <label htmlFor="firstName">First Name (optional)</label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Maria"
              />
            </div>

            <div style={{ ...fieldStyle, marginTop: '1rem' }}>
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                <option value="caregiver">Caregiver</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" style={{ marginTop: '1rem' }}>Create Invite</button>
          </form>

          {error && (
            <div role="alert" style={errorBoxStyle}>{error}</div>
          )}

          {latestInvite && (
            <div style={inviteCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {emailSent === true && (
                  <span style={emailBadgeOkStyle}>✓ Email sent</span>
                )}
                {emailSent === false && (
                  <span style={emailBadgeFailStyle}>⚠ Email not sent</span>
                )}
              </div>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.9rem' }}>
                <strong>Invite created for {latestInvite.email}</strong>
                {emailSent === false && ' — copy the link below and share it with them.'}
              </p>
              {emailSent === false && (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#7c2d12' }}>
                  Email delivery is not currently configured. Set <code>RESEND_API_KEY</code> in Vercel,
                  then future invites will email automatically.
                </p>
              )}
              <div style={linkRowStyle}>
                <code style={linkCodeStyle}>{latestInvite.acceptanceUrl}</code>
                <button onClick={() => void handleCopy()} style={copyBtnStyle}>
                  {copyState === 'copied' ? '✓ Copied' : 'Copy link'}
                </button>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Expires {new Date(latestInvite.expiresAt).toLocaleString()} ·
                Single-use — once they accept, the link stops working.
              </p>
            </div>
          )}
        </div>

        <div>
          <h3>Active Staff Directory</h3>
          {staff.length === 0 ? (
            <div style={emptyStateStyle}>No staff found. Send an invite to add one.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {staff.map((s) => (
                <li key={s.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{s.email}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Role: {s.role}</div>
                  </div>
                  <div style={statusPillStyle(s.status)}>
                    {s.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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

const errorBoxStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '8px',
};

const inviteCardStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '1rem 1.1rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  backgroundColor: '#f8fafc',
};

const emailBadgeOkStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.55rem',
  borderRadius: '999px',
  backgroundColor: '#E1F5EE',
  color: '#085041',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const emailBadgeFailStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.55rem',
  borderRadius: '999px',
  backgroundColor: '#FAEEDA',
  color: '#633806',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const linkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginTop: '0.4rem',
};

const linkCodeStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.75rem',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: '0.8rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  overflowX: 'auto',
  whiteSpace: 'nowrap',
};

const copyBtnStyle: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  padding: '0.5rem 0.85rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  color: '#64748b',
  marginTop: '1rem',
};

function statusPillStyle(status: string): React.CSSProperties {
  const isPending = status === 'pending';
  return {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: isPending ? '#fef3c7' : '#e0f2fe',
    color: isPending ? '#d97706' : '#0284c7',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
}
