import React, { useCallback, useEffect, useRef, useState } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

/**
 * Hidden platform super-admin command center for Durga Ghimeray (Founder & CEO).
 * Not linked from any nav. Password + device-biometric (WebAuthn) login, then a
 * cross-agency monitoring console. Token (scope:'platform') lives in
 * sessionStorage, separate from the agency cookie session.
 */

const TOKEN_KEY = 'rayhealth_platform_token';
const CEO_NAME = 'Durga Ghimeray';
const CEO_TITLE = 'Founder & CEO';
const CEO_INITIALS = 'DG';

interface AgencyRow {
  id: string;
  name: string;
  state: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  userCount: number;
  clientCount: number;
  adminEmails: string[];
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  agencyId: string;
  agencyName: string | null;
  createdAt: string | null;
  suspendedAt: string | null;
}

interface Stats {
  agencies: { total: number; pending: number; approved: number; rejected: number };
  users: { total: number; suspended: number; byRole: Record<string, number> };
  clients: number;
  caregivers: { total: number; active: number };
  visits: { total: number; today: number; last7d: number; verified: number };
  exceptions: { open: number };
  claims: { total: number; byStatus: Record<string, number>; chargedCents: number; paidCents: number };
  generatedAt: string;
}

interface ActivityRow {
  id: string;
  eventType: string;
  entityType: string;
  actorType: string;
  outcome: string;
  agencyId: string;
  agencyName: string | null;
  occurredAt: string | null;
}

interface AgencyDetail extends AgencyRow {
  caregiverCount: number;
  visitCount: number;
  claimCount: number;
  chargedCents: number;
  users: UserRow[];
  recentActivity: ActivityRow[];
}

// High-contrast light palette. Text is slate-900 on white for maximum
// legibility; accent colors are the darker AA-contrast variants.
const C = {
  appBg: '#eef1f6',
  card: '#ffffff',
  cardAlt: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  muted: '#475569',
  faint: '#94a3b8',
  sidebarFrom: '#4338ca',
  sidebarTo: '#7c3aed',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  green: '#059669', greenSoft: '#ecfdf5',
  amber: '#b45309', amberSoft: '#fffbeb',
  red: '#dc2626', redSoft: '#fef2f2',
  cyan: '#0e7490', cyanSoft: '#ecfeff',
  pink: '#be185d', pinkSoft: '#fdf2f8',
  violet: '#7c3aed', violetSoft: '#f5f3ff',
};

const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Working late';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_TONE: Record<string, string> = {
  'account.suspended': C.red,
  'agency.review.rejected': C.red,
  'agency.review.approved': C.green,
  'account.reactivated': C.green,
  'auth.login.failure': C.amber,
  'permission.denied': C.amber,
  'csrf.failure': C.amber,
};
const eventTone = (e: string): string => EVENT_TONE[e] ?? (e.includes('fail') || e.includes('denied') ? C.amber : C.cyan);

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const err = new Error(body.message || `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ---------------- presentational pieces ----------------

const SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)';

function StatusBadge({ status }: { status: AgencyRow['reviewStatus'] }) {
  const map = {
    approved: { fg: C.green, bg: C.greenSoft, label: 'Approved' },
    rejected: { fg: C.red, bg: C.redSoft, label: 'Rejected' },
    pending: { fg: C.amber, bg: C.amberSoft, label: 'Pending' },
  }[status];
  return (
    <span style={{ color: map.fg, background: map.bg, border: `1px solid ${map.fg}33`, borderRadius: 999, padding: '0.18rem 0.65rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {map.label}
    </span>
  );
}

function KpiCard({ label, value, sub, tone, soft, icon }: { label: string; value: string; sub?: string; tone: string; soft: string; icon: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.1rem', boxShadow: SHADOW }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>{icon}</div>
        <div style={{ color: C.muted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      </div>
      <div style={{ color: C.text, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontSize: '0.78rem', marginTop: '0.4rem' }}>{sub}</div>}
      <div style={{ height: 3, background: tone, borderRadius: 3, marginTop: '0.85rem', opacity: 0.85 }} />
    </div>
  );
}

const btn = (bg: string, variant?: 'ghost' | 'soft'): React.CSSProperties => ({
  background: variant === 'ghost' ? 'transparent' : variant === 'soft' ? `${bg}14` : bg,
  color: variant ? bg : '#fff',
  border: variant === 'ghost' ? `1px solid ${C.borderStrong}` : variant === 'soft' ? `1px solid ${bg}33` : 'none',
  borderRadius: 9, padding: '0.45rem 0.85rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
});

const rowCard: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: SHADOW,
  padding: '0.85rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
};

function Panel({ title, action, children, scroll }: { title: string; action?: React.ReactNode; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: SHADOW, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: C.text }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: '1rem 1.2rem', ...(scroll ? { maxHeight: 520, overflowY: 'auto' } : {}) }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.faint, fontSize: '0.86rem', padding: '0.6rem 0' }}>{children}</div>;
}

function ActivityItem({ ev }: { ev: ActivityRow }) {
  const tone = eventTone(ev.eventType);
  return (
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: tone, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: C.text }}>{ev.eventType}</div>
        <div style={{ color: C.muted, fontSize: '0.74rem' }}>{ev.agencyName ?? '—'} · {ev.actorType} · {ev.outcome}</div>
      </div>
      <span style={{ color: C.faint, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{timeAgo(ev.occurredAt)}</span>
    </div>
  );
}

function UserRowView({ u, busy, onToggle }: { u: UserRow; busy: boolean; onToggle: () => void }) {
  return (
    <div style={{ ...rowCard, padding: '0.7rem 1rem' }}>
      <div>
        <div style={{ fontWeight: 600, color: C.text }}>
          {u.email} {u.suspendedAt && <span style={{ color: C.red, fontSize: '0.68rem', fontWeight: 800, background: C.redSoft, padding: '0.05rem 0.4rem', borderRadius: 5 }}>SUSPENDED</span>}
        </div>
        <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: '0.18rem', textTransform: 'capitalize' }}>{u.role} · {u.agencyName ?? u.agencyId.slice(0, 8)} · joined {timeAgo(u.createdAt)}</div>
      </div>
      <button type="button" disabled={busy} onClick={onToggle} style={btn(u.suspendedAt ? C.green : C.red, u.suspendedAt ? undefined : 'soft')}>{u.suspendedAt ? 'Reactivate' : 'Suspend'}</button>
    </div>
  );
}

// ============================================================

export function SuperAdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [bioStatus, setBioStatus] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [detail, setDetail] = useState<AgencyDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'agencies' | 'users'>('overview');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStats(null); setAgencies([]); setUsers([]); setActivity([]); setDetail(null);
  }, []);

  const load = useCallback(async (t: string) => {
    setLoadErr(null);
    try {
      const [s, a, u, act] = await Promise.all([
        api<Stats>('/stats', t),
        api<AgencyRow[]>('/agencies', t),
        api<UserRow[]>('/users', t),
        api<ActivityRow[]>('/activity?limit=50', t),
      ]);
      setStats(s); setAgencies(a); setUsers(u); setActivity(act);
      setLastSync(new Date());
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) { logout(); setLoginErr('Session expired. Sign in again.'); }
      else setLoadErr(e.message);
    }
  }, [logout]);

  useEffect(() => { if (token) void load(token); }, [token, load]);
  useEffect(() => {
    const c = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(c);
  }, []);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  useEffect(() => {
    if (!token) return;
    const r = setInterval(() => { if (tokenRef.current) void load(tokenRef.current); }, 30000);
    return () => clearInterval(r);
  }, [token, load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true); setLoginErr(null); setBioStatus(null);
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { stage?: 'enroll' | '2fa'; stageToken?: string; options?: unknown; message?: string };
      if (!res.ok || !body.stage || !body.stageToken) { setLoginErr(body.message || 'Invalid credentials'); return; }
      if (!browserSupportsWebAuthn()) { setLoginErr('This browser lacks device biometrics. Use a device with Face ID / Windows Hello.'); return; }

      let verifyPath: string; let verifyBody: Record<string, unknown>;
      if (body.stage === 'enroll') {
        setBioStatus('First sign-in on this device — set up Face ID / biometric…');
        const att = await startRegistration({ optionsJSON: body.options as never });
        verifyPath = '/api/superadmin/webauthn/register/verify';
        verifyBody = { stageToken: body.stageToken, response: att, deviceLabel: navigator.platform || 'device' };
      } else {
        setBioStatus('Confirm your identity with Face ID / biometric…');
        const asr = await startAuthentication({ optionsJSON: body.options as never });
        verifyPath = '/api/superadmin/webauthn/authenticate/verify';
        verifyBody = { stageToken: body.stageToken, response: asr };
      }
      const vres = await fetch(verifyPath, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(verifyBody) });
      const vbody = (await vres.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!vres.ok || !vbody.token) { setLoginErr(vbody.message || 'Biometric verification failed.'); return; }
      sessionStorage.setItem(TOKEN_KEY, vbody.token);
      setPassword(''); setToken(vbody.token);
    } catch (err) {
      setLoginErr((err as Error)?.message || 'Biometric prompt was cancelled.');
    } finally {
      setLoggingIn(false); setBioStatus(null);
    }
  };

  const reviewAgency = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    setBusy(id);
    try { await api(`/agencies/${id}/${action}`, token, { method: 'POST', body: JSON.stringify({}) }); await load(token); if (detail?.id === id) void openDetail(id); }
    catch (err) { setLoadErr((err as Error).message); }
    finally { setBusy(null); }
  };
  const toggleSuspend = async (u: UserRow) => {
    if (!token) return;
    setBusy(u.id);
    try { await api(`/users/${u.id}/${u.suspendedAt ? 'reactivate' : 'suspend'}`, token, { method: 'POST', body: JSON.stringify({}) }); await load(token); if (detail) void openDetail(detail.id); }
    catch (err) { setLoadErr((err as Error).message); }
    finally { setBusy(null); }
  };
  const openDetail = async (id: string) => {
    if (!token) return;
    try { setDetail(await api<AgencyDetail>(`/agencies/${id}`, token)); }
    catch (err) { setLoadErr((err as Error).message); }
  };

  // ===================== LOGIN =====================
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${C.sidebarFrom}, ${C.sidebarTo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ background: C.card, borderRadius: 20, padding: '2.25rem', width: 390, display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${C.sidebarFrom}, ${C.sidebarTo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{CEO_INITIALS}</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', color: C.text }}>Command Center</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: '0.8rem' }}>RayHealth Platform · restricted</p>
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: C.muted, fontWeight: 600 }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required
              style={{ background: '#fff', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 9, padding: '0.65rem 0.8rem', fontSize: '0.95rem' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: C.muted, fontWeight: 600 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required
              style={{ background: '#fff', border: `1px solid ${C.borderStrong}`, color: C.text, borderRadius: 9, padding: '0.65rem 0.8rem', fontSize: '0.95rem' }} />
          </label>
          {bioStatus && <div role="status" style={{ color: C.accent, fontSize: '0.82rem', background: C.accentSoft, padding: '0.55rem 0.75rem', borderRadius: 8 }}>{bioStatus}</div>}
          {loginErr && <div role="alert" style={{ color: C.red, fontSize: '0.82rem', background: C.redSoft, padding: '0.55rem 0.75rem', borderRadius: 8 }}>{loginErr}</div>}
          <button type="submit" disabled={loggingIn} style={{ ...btn(C.accent), opacity: loggingIn ? 0.6 : 1, padding: '0.75rem', fontSize: '0.92rem' }}>
            {loggingIn ? 'Verifying…' : 'Sign in'}
          </button>
          <p style={{ margin: 0, color: C.faint, fontSize: '0.72rem', textAlign: 'center' }}>Password + device biometric (Face ID / Windows Hello).</p>
        </form>
      </div>
    );
  }

  // ===================== DASHBOARD =====================
  const pending = agencies.filter((a) => a.reviewStatus === 'pending');
  const fmtTime = clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const fmtDate = clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const navItem = (key: typeof tab, label: string, icon: string, badge?: number) => {
    const active = tab === key;
    return (
      <button key={key} type="button" onClick={() => { setTab(key); setDetail(null); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', textAlign: 'left',
          background: active ? 'rgba(255,255,255,0.18)' : 'transparent', color: '#fff',
          border: 'none', borderRadius: 10, padding: '0.65rem 0.8rem', cursor: 'pointer',
          fontSize: '0.9rem', fontWeight: active ? 700 : 500,
        }}>
        <span style={{ fontSize: '1.05rem', width: 20, textAlign: 'center' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge ? <span style={{ background: '#fff', color: C.sidebarFrom, borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, padding: '0.05rem 0.45rem' }}>{badge}</span> : null}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: C.appBg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif', display: 'flex' }}>
      {/* sidebar */}
      <aside style={{ width: 248, flexShrink: 0, background: `linear-gradient(180deg, ${C.sidebarFrom}, ${C.sidebarTo})`, color: '#fff', padding: '1.4rem 1rem', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 0.4rem', marginBottom: '1.6rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>{CEO_INITIALS}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CEO_NAME}</div>
            <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>{CEO_TITLE}</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItem('overview', 'Overview', '◎')}
          {navItem('agencies', 'Agencies', '▦', pending.length || undefined)}
          {navItem('users', 'Users', '◔')}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', opacity: 0.9, padding: '0 0.4rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
            Live · auto-refresh 30s
          </div>
          <button type="button" onClick={logout} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '0.6rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Sign out</button>
        </div>
      </aside>

      {/* main */}
      <main style={{ flex: 1, minWidth: 0, padding: '1.6rem 2rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{greeting()}, Durga</div>
            <div style={{ color: C.muted, fontSize: '0.88rem', marginTop: '0.25rem' }}>Here's everything happening across the platform right now.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.3rem', fontWeight: 800, color: C.text }}>{fmtTime}</div>
            <div style={{ color: C.muted, fontSize: '0.8rem' }}>{fmtDate}{lastSync ? ` · synced ${timeAgo(lastSync.toISOString())}` : ''}</div>
          </div>
        </header>

        {pending.length > 0 && (
          <div style={{ background: C.amberSoft, border: `1px solid ${C.amber}44`, borderRadius: 12, padding: '0.8rem 1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.7rem', fontSize: '0.9rem' }}>
            <span style={{ fontSize: '1.15rem' }}>⚠️</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{pending.length} agenc{pending.length === 1 ? 'y' : 'ies'} awaiting your review</span>
            <button type="button" onClick={() => setTab('agencies')} style={{ ...btn(C.amber, 'soft'), marginLeft: 'auto' }}>Review now →</button>
          </div>
        )}

        {loadErr && <div role="alert" style={{ color: C.red, background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem' }}>{loadErr}</div>}

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem', marginBottom: '1.5rem' }}>
          <KpiCard label="Agencies" icon="🏢" value={String(stats?.agencies.total ?? '—')} sub={`${stats?.agencies.approved ?? 0} active · ${stats?.agencies.pending ?? 0} pending`} tone={C.accent} soft={C.accentSoft} />
          <KpiCard label="Users" icon="👥" value={String(stats?.users.total ?? '—')} sub={`${stats?.users.suspended ?? 0} suspended`} tone={C.cyan} soft={C.cyanSoft} />
          <KpiCard label="Clients" icon="🧑" value={String(stats?.clients ?? '—')} sub="across all agencies" tone={C.pink} soft={C.pinkSoft} />
          <KpiCard label="Caregivers" icon="🩺" value={String(stats?.caregivers.total ?? '—')} sub={`${stats?.caregivers.active ?? 0} active`} tone={C.green} soft={C.greenSoft} />
          <KpiCard label="Visits today" icon="📍" value={String(stats?.visits.today ?? '—')} sub={`${stats?.visits.last7d ?? 0} in 7d · ${stats?.visits.total ?? 0} all-time`} tone={C.violet} soft={C.violetSoft} />
          <KpiCard label="Open exceptions" icon="⚠️" value={String(stats?.exceptions.open ?? '—')} sub="need resolution" tone={(stats?.exceptions.open ?? 0) > 0 ? C.amber : C.green} soft={(stats?.exceptions.open ?? 0) > 0 ? C.amberSoft : C.greenSoft} />
          <KpiCard label="Claims" icon="🧾" value={String(stats?.claims.total ?? '—')} sub={`${money(stats?.claims.chargedCents ?? 0)} billed`} tone={C.cyan} soft={C.cyanSoft} />
          <KpiCard label="Collected" icon="💰" value={money(stats?.claims.paidCents ?? 0)} sub="remittances posted" tone={C.green} soft={C.greenSoft} />
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <Panel title="Needs your attention">
                {pending.length === 0 ? <Empty>All clear — no agencies awaiting review.</Empty> : pending.map((a) => (
                  <div key={a.id} style={{ ...rowCard, boxShadow: 'none', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: C.text }}>{a.name}</div>
                      <div style={{ color: C.muted, fontSize: '0.8rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · signed up {timeAgo(a.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn(C.green)}>Approve</button>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn(C.red, 'soft')}>Reject</button>
                    </div>
                  </div>
                ))}
              </Panel>
              <Panel title="Team by role">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {stats && Object.entries(stats.users.byRole).map(([role, n]) => (
                    <div key={role} style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.55rem 0.85rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: C.text }}>{n}</span>
                      <span style={{ color: C.muted, fontSize: '0.8rem', marginLeft: '0.4rem', textTransform: 'capitalize' }}>{role}</span>
                    </div>
                  ))}
                  {(!stats || Object.keys(stats.users.byRole).length === 0) && <Empty>No users yet.</Empty>}
                </div>
              </Panel>
            </div>
            <Panel title="Live activity" action={<span style={{ color: C.faint, fontSize: '0.72rem' }}>{activity.length} events</span>} scroll>
              {activity.length === 0 ? <Empty>No recent activity.</Empty> : activity.map((ev) => <ActivityItem key={ev.id} ev={ev} />)}
            </Panel>
          </div>
        )}

        {/* AGENCIES */}
        {tab === 'agencies' && (detail ? (
          <AgencyDetailView detail={detail} busy={busy} onBack={() => setDetail(null)} onReview={reviewAgency} onToggleSuspend={toggleSuspend} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {agencies.length === 0 && <Empty>No agencies yet.</Empty>}
            {agencies.map((a) => (
              <div key={a.id} style={{ ...rowCard, borderColor: a.reviewStatus === 'pending' ? `${C.amber}66` : C.border, cursor: 'pointer' }} onClick={() => openDetail(a.id)}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text }}>{a.name} <span style={{ color: C.faint, fontWeight: 400, fontSize: '0.8rem' }}>· {a.state}</span></div>
                  <div style={{ color: C.muted, fontSize: '0.8rem', marginTop: '0.2rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · {a.userCount} users · {a.clientCount} clients · signed up {timeAgo(a.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={a.reviewStatus} />
                  {a.reviewStatus !== 'approved' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn(C.green)}>Approve</button>}
                  {a.reviewStatus !== 'rejected' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn(C.red, 'soft')}>Reject</button>}
                  <span style={{ color: C.faint, fontSize: '1.15rem' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* USERS */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.length === 0 && <Empty>No users yet.</Empty>}
            {users.map((u) => <UserRowView key={u.id} u={u} busy={busy === u.id} onToggle={() => toggleSuspend(u)} />)}
          </div>
        )}

        <footer style={{ marginTop: '2.5rem', textAlign: 'center', color: C.faint, fontSize: '0.74rem' }}>
          RayHealth Platform Command Center · for {CEO_NAME} only · every action is audit-logged
        </footer>
      </main>
    </div>
  );
}

function AgencyDetailView({ detail, busy, onBack, onReview, onToggleSuspend }: {
  detail: AgencyDetail; busy: string | null; onBack: () => void;
  onReview: (id: string, a: 'approve' | 'reject') => void; onToggleSuspend: (u: UserRow) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={btn(C.accent, 'ghost')}>← All agencies</button>
        <h2 style={{ margin: 0, fontSize: '1.3rem', color: C.text }}>{detail.name}</h2>
        <StatusBadge status={detail.reviewStatus} />
        <span style={{ color: C.muted, fontSize: '0.82rem' }}>{detail.state} · signed up {timeAgo(detail.createdAt)}{detail.reviewedBy ? ` · reviewed by ${detail.reviewedBy}` : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem' }}>
          {detail.reviewStatus !== 'approved' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'approve')} style={btn(C.green)}>Approve</button>}
          {detail.reviewStatus !== 'rejected' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'reject')} style={btn(C.red, 'soft')}>Reject</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem' }}>
        <KpiCard label="Users" icon="👥" value={String(detail.userCount)} tone={C.cyan} soft={C.cyanSoft} />
        <KpiCard label="Clients" icon="🧑" value={String(detail.clientCount)} tone={C.pink} soft={C.pinkSoft} />
        <KpiCard label="Caregivers" icon="🩺" value={String(detail.caregiverCount)} tone={C.green} soft={C.greenSoft} />
        <KpiCard label="Visits" icon="📍" value={String(detail.visitCount)} tone={C.violet} soft={C.violetSoft} />
        <KpiCard label="Claims" icon="🧾" value={String(detail.claimCount)} sub={money(detail.chargedCents)} tone={C.accent} soft={C.accentSoft} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.1rem' }}>
        <Panel title={`Users (${detail.users.length})`} scroll>
          {detail.users.length === 0 ? <Empty>No users.</Empty> : detail.users.map((u) => (
            <div key={u.id} style={{ marginBottom: '0.5rem' }}><UserRowView u={u} busy={busy === u.id} onToggle={() => onToggleSuspend(u)} /></div>
          ))}
        </Panel>
        <Panel title="Recent activity" scroll>
          {detail.recentActivity.length === 0 ? <Empty>No activity.</Empty> : detail.recentActivity.map((ev) => <ActivityItem key={ev.id} ev={ev} />)}
        </Panel>
      </div>
    </div>
  );
}
