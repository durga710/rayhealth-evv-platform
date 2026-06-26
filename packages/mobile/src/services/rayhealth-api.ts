/*
 * RayHealth mobile API client — option-B adapter against the
 * `rayhealth-evv-clean` backend (production: https://rayhealthevv.com/api).
 *
 * This file used to assume a richer API surface (refresh tokens, /sync/*,
 * /users/profile, /invitations/*, /mobile/visits/* CRUD, response envelope
 * `{success, data}`). The shipped backend uses bearer JWT mobile auth and
 * a smaller set of EVV routes. Rather than rebuild the backend to match,
 * this adapter rewires the public methods so existing callers in
 * AuthContext.tsx and dataService.ts keep compiling — endpoints that
 * don't exist yet throw a clear NotImplementedError (HTTP 501).
 *
 * Endpoint map:
 *   login()              → POST /auth/mobile/login   (returns {token, role, agencyId})
 *   logout()             → POST /auth/mobile/logout
 *   getTodayVisits()     → GET  /evv/visits          (filtered to today client-side)
 *   getVisitById()       → GET  /evv/visits          (filter by id client-side)
 *   getVisitTasks()      → GET  /tasks               (returns the PA task catalog;
 *                                                     not visit-specific yet)
 *   startVisit(id)       → POST /evv/clock-in        (id is the assignment id)
 *   endVisit(id)         → POST /evv/clock-out/:id   (id is the visit id)
 *   getProfile()         → synthesized from JWT      (no backend endpoint yet)
 *   registerDevice()     → no-op                     (no backend endpoint yet)
 *   completeTask()       → 501                       (not built)
 *   getSyncStatus(), pullSync() → 501                (not built)
 *   refreshAccessToken() → not implemented; on 401 we clear session and ask
 *                          the user to sign in again
 *   updateProfile, changePassword,
 *   getInvitationDetails, acceptInvitation,
 *   request/confirm/validate password reset → 501
 */
import {
  getRayHealthApiBaseUrl,
  type PullChangesQueryOptions,
  type RayHealthAcceptInviteRequest,
  type RayHealthInviteDetails,
  type RayHealthLoginResult,
  type RayHealthLoginUser,
  type RayHealthMobileVisit,
  type RayHealthTask,
  type TodayScheduleResponse,
} from './rayhealth-contract';
import {
  buildSessionFromLogin,
  clearSession,
  getStoredSession,
  saveSession,
  updateStoredSession,
} from './rayhealth-session';

class RayHealthApiError extends Error {
  status?: number;
  code?: string;
  context?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; context?: unknown }) {
    super(message);
    this.name = 'RayHealthApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.context = options?.context;
  }
}

function notImplemented(feature: string): never {
  // User-facing message — surfaced via toast.error(error.message) in screens
  // such as ForgotPasswordScreen, AcceptInviteScreen, ProfileScreen. Keep it
  // human, no backend jargon. The 501 + NOT_IMPLEMENTED still show up in
  // logs and the RayHealthApiError instance for engineering diagnosis.
  throw new RayHealthApiError(
    `${feature} is coming soon. Please contact your agency administrator if you need this right away.`,
    { status: 501, code: 'NOT_IMPLEMENTED' },
  );
}

/**
 * Decode a JWT body without signature verification. Used purely to
 * populate the local user object after login — the backend already
 * verified the token when it issued it.
 */
type JwtBody = {
  sub?: string;
  agencyId?: string;
  role?: string;
  caregiverId?: string;
  jti?: string;
  exp?: number;
};
function decodeJwtBody(token: string): JwtBody {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const base64 = padded + '==='.slice((padded.length + 3) % 4);
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
    return JSON.parse(decodeURIComponent(escape(json))) as JwtBody;
  } catch {
    return {};
  }
}

/**
 * Bare request — backend returns flat JSON, no `{success, data}` envelope.
 * On 401 we clear the session and surface the error; there is no refresh
 * endpoint, so the UI must drive a fresh login.
 */
async function request<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, headers, ...rest } = options;
  const session = getStoredSession();
  const resolvedHeaders = new Headers(headers);

  if (!resolvedHeaders.has('Accept')) {
    resolvedHeaders.set('Accept', 'application/json');
  }
  if (rest.body !== undefined && !resolvedHeaders.has('Content-Type')) {
    resolvedHeaders.set('Content-Type', 'application/json');
  }
  if (authenticated) {
    if (!session?.accessToken) {
      throw new RayHealthApiError('Please sign in to continue.', { status: 401 });
    }
    resolvedHeaders.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${getRayHealthApiBaseUrl()}${path}`, {
    ...rest,
    headers: resolvedHeaders,
    // Mobile uses bearer auth, not cookies — keep the request CORS-friendly.
    credentials: 'omit',
  });

  // 204 / empty body — nothing to parse.
  const text = await response.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new RayHealthApiError(text, { status: response.status });
      }
    }
  }

  if (response.status === 401 && authenticated) {
    clearSession();
    throw new RayHealthApiError('Session expired. Please sign in again.', {
      status: 401,
      code: 'SESSION_EXPIRED',
    });
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : undefined) ?? `Request failed (${response.status})`;
    throw new RayHealthApiError(message, { status: response.status, context: parsed });
  }

  return (parsed ?? undefined) as T;
}

/**
 * Adapt the backend's `/auth/mobile/login` flat response into the shape the
 * mobile codebase expects. Backend returns `{token, role, agencyId}`; mobile
 * needs `{user: {id, email, name, roles, permissions, organizationId},
 * tokens: {accessToken, refreshToken}}`. We synthesize the user from the
 * JWT claims plus the email the user just typed.
 */
function adaptLoginResponse(
  backendResponse: { token: string; role: string; agencyId: string; firstName?: string; lastName?: string },
  loginEmail: string,
): RayHealthLoginResult {
  const claims = decodeJwtBody(backendResponse.token);
  // Prefer the backend's display name (real `caregivers.first_name` /
  // `caregivers.last_name` joined into the login response) when present.
  // If the backend doesn't return them yet, fall back to the email
  // local-part — but only if it looks vaguely human (letters, optionally
  // a single space). For machine-shaped fixtures or addresses with
  // dashes/dots/digits (e.g. `test-caregiver-fixture`) we fall back to
  // empty string so the UI's `firstName || 'there'` greeting kicks in.
  const backendDisplayName = [backendResponse.firstName, backendResponse.lastName]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' ')
    .trim();
  let derivedName = '';
  if (backendDisplayName) {
    derivedName = backendDisplayName;
  } else {
    const localPart = loginEmail.split('@')[0] ?? loginEmail;
    if (/^[a-zA-Z]+(?:\s[a-zA-Z]+)?$/.test(localPart)) {
      derivedName = localPart;
    }
  }
  const user: RayHealthLoginUser = {
    id: claims.sub ?? '',
    email: loginEmail,
    name: derivedName,
    // The mobile's role mapper checks UPPERCASE role names ('CAREGIVER',
    // 'ORG_ADMIN', etc.). Our backend stores lowercase role strings, so
    // upper-case here for the mapper to land on the right bucket.
    roles: [String(backendResponse.role).toUpperCase()],
    permissions: [],
    organizationId: backendResponse.agencyId,
  };
  return {
    user,
    tokens: {
      accessToken: backendResponse.token,
      // No refresh token — single 8h JWT. Empty string signals "no refresh".
      refreshToken: '',
    },
  };
}

export const rayhealthApi = {
  async login(email: string, password: string): Promise<RayHealthLoginResult> {
    const backend = await request<{ token: string; role: string; agencyId: string; firstName?: string; lastName?: string }>(
      '/auth/mobile/login',
      {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({ email, password }),
      },
    );
    if (!backend?.token) {
      throw new RayHealthApiError('Login response was incomplete.');
    }
    return adaptLoginResponse(backend, email);
  },

  async logout(): Promise<void> {
    try {
      await request<unknown>('/auth/mobile/logout', { method: 'POST' });
    } catch {
      // Logout is best-effort — even if the server rejects it, blow away
      // the local session so the device is no longer authenticated.
    } finally {
      clearSession();
    }
  },

  /**
   * Today's scheduled assignments for the signed-in caregiver. Backed
   * by `GET /mobile/caregiver/today`. Used by the dashboard to render
   * scheduled visits with patient name, address, geofence radius, and a
   * countdown to the scheduled clock-in time (the 30-second pre-warning
   * timer service consumes this same endpoint).
   */
  async getTodaysSchedule(): Promise<TodayScheduleResponse> {
    const r = await request<TodayScheduleResponse>('/mobile/caregiver/today');
    if (!r) return { schedule: [], serverTime: new Date().toISOString() };
    // Backend's left-join produces one row per (assignment × visit), so an
    // assignment with two visits today (e.g. completed + in-progress)
    // duplicates. Dedupe by assignmentId, preferring the most actionable
    // status: pending > verified|corrected > null. This is a client-side
    // patch; the durable fix is a window-function `DISTINCT ON
    // (assignment_id) ... ORDER BY assignment_id, visit.created_at DESC`
    // server-side. Safe to drop once the backend deduplicates.
    const rank = (s: string | null): number => {
      if (s === 'pending') return 3;
      if (s === 'verified' || s === 'corrected') return 2;
      if (s) return 1;
      return 0;
    };
    const byAssignment = new Map<string, typeof r.schedule[number]>();
    for (const row of r.schedule) {
      const existing = byAssignment.get(row.assignmentId);
      if (!existing || rank(row.currentVisitStatus) > rank(existing.currentVisitStatus)) {
        byAssignment.set(row.assignmentId, row);
      }
    }
    return { schedule: Array.from(byAssignment.values()), serverTime: r.serverTime };
  },

  /**
   * Look up an invite by its UUID share-token. Backend route is
   * `GET /invitations/:token` (public, no auth — the token itself is
   * the credential). Adapts the backend's flat envelope into the
   * `RayHealthInviteDetails` shape the existing mobile screens expect.
   */
  async getInvitationDetails(token: string): Promise<RayHealthInviteDetails> {
    type BackendInvite = {
      token: string;
      email: string;
      role: string;
      agencyId: string;
      agencyName: string | null;
      expiresAt: string;
      status: string;
      isValid: boolean;
    };
    const r = await request<BackendInvite>(`/invitations/${encodeURIComponent(token)}`, {
      authenticated: false,
    });
    if (!r || !r.token) {
      throw new RayHealthApiError('Invitation lookup returned no data.', { status: 404 });
    }
    const statusUpper = String(r.status ?? 'pending').toUpperCase();
    const statusMobile: RayHealthInviteDetails['status'] =
      statusUpper === 'ACCEPTED'
        ? 'ACCEPTED'
        : statusUpper === 'EXPIRED'
          ? 'EXPIRED'
          : statusUpper === 'REVOKED'
            ? 'REVOKED'
            : 'PENDING';
    return {
      token: r.token,
      // Backend has no separate access code; the UUID token IS the
      // credential. Surface it as `accessCode` for screens that ask
      // for one explicitly.
      accessCode: r.token,
      email: r.email,
      firstName: null,
      lastName: null,
      organizationName: r.agencyName ?? '',
      organizationId: r.agencyId,
      roles: [String(r.role ?? 'caregiver').toUpperCase()],
      expiresAt: r.expiresAt,
      status: statusMobile,
      isValid: r.isValid,
    };
  },

  /**
   * Redeem an invite — creates a `caregivers` row (when role=caregiver)
   * and a `users` row in one server-side transaction, then marks the
   * invite single-used. Backend route: `POST /invitations/accept`.
   * The mobile flow follows by calling `login()` to get a JWT.
   */
  async acceptInvitation(body: RayHealthAcceptInviteRequest): Promise<void> {
    await request<{ userId: string; message: string }>('/invitations/accept', {
      method: 'POST',
      authenticated: false,
      body: JSON.stringify({
        token: body.token,
        firstName: body.firstName,
        lastName: body.lastName,
        password: body.password,
        ...(body.phone ? { phone: body.phone } : {}),
      }),
    });
  },
  async requestPasswordReset(_email: string): Promise<void> {
    notImplemented('Password reset request');
  },
  async confirmPasswordReset(_token: string, _password: string): Promise<void> {
    notImplemented('Password reset confirmation');
  },
  async validatePasswordResetToken(_token: string): Promise<{ email: string }> {
    notImplemented('Password reset token validation');
  },
  async getSyncStatus(): Promise<{ organizationId: string; userId: string; lastSyncAt: number }> {
    notImplemented('Sync status');
  },
  async pullSync(
    _query: PullChangesQueryOptions,
  ): Promise<{ changes: unknown[]; timestamp: number; hasMore: boolean }> {
    notImplemented('Sync pull');
  },
  async updateProfile(_body: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
  }> {
    notImplemented('Profile update');
  },
  async changePassword(_currentPassword: string, _newPassword: string): Promise<void> {
    notImplemented('Password change');
  },
  async completeTask(
    _id: string,
    _body: { notes?: string; completedValue?: boolean },
  ): Promise<RayHealthTask> {
    notImplemented('Task completion');
  },

  /**
   * Refresh the signed-in user's display name and org context. Hits
   * `GET /auth/mobile/me` so a session minted before the firstName/
   * lastName login-response augmentation (or one that pre-dates a
   * caregiver-row rename) updates without the user having to log out
   * and back in. If the network is unavailable or the endpoint is
   * missing on an older deploy, fall back to the locally-cached
   * session — read-only, never throws PII to the UI.
   */
  async getProfile(): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roles: string[];
  }> {
    const session = getStoredSession();
    if (!session) {
      throw new RayHealthApiError('Please sign in to continue.', { status: 401 });
    }
    const claims = decodeJwtBody(session.accessToken);
    try {
      const me = await request<{
        id: string;
        email: string;
        role: string;
        agencyId: string;
        firstName?: string;
        lastName?: string;
      }>('/auth/mobile/me');
      if (me) {
        return {
          id: me.id,
          email: me.email,
          firstName: me.firstName ?? '',
          lastName: me.lastName ?? '',
          organizationId: me.agencyId,
          roles: [String(me.role).toUpperCase()],
        };
      }
    } catch {
      // Network or 404 (older backend deploy) — fall through to local
      // synthesis below.
    }
    // Normalize cached firstName/lastName: drop any value that doesn't
    // look like a real name. Older sessions persisted the email-local-
    // part (e.g. 'test-caregiver-fixture'); we want UIs to fall back to
    // friendly defaults rather than greet with the email handle.
    const looksLikeRealName = (s: string | undefined | null): boolean =>
      typeof s === 'string' && /^[a-zA-Z]+(?:\s[a-zA-Z]+)?$/.test(s);
    return {
      id: claims.sub ?? session.user.id,
      email: session.user.email,
      firstName: looksLikeRealName(session.user.firstName) ? session.user.firstName : '',
      lastName: looksLikeRealName(session.user.lastName) ? session.user.lastName : '',
      organizationId: claims.agencyId ?? session.user.organizationId,
      roles: [String(claims.role ?? 'caregiver').toUpperCase()],
    };
  },

  /**
   * Adapter over GET /evv/visits — the backend returns the agency's full
   * visit list (or just the caregiver's, server-side-scoped). The
   * backend's row shape is the EvvVisit schema (clockInTime,
   * clockOutTime, ...) which doesn't have the scheduledStartTime field
   * the mobile mapper expects, so we both filter on clockInTime AND
   * derive scheduledStartTime/scheduledEndTime so downstream code has
   * something to render.
   */
  async getTodayVisits(): Promise<{
    visits: RayHealthMobileVisit[];
    summary: Record<string, number>;
    serverTime: string;
  }> {
    type BackendVisit = RayHealthMobileVisit & {
      clockInTime?: string;
      clockOutTime?: string | null;
    };
    const all = await request<BackendVisit[]>('/evv/visits');
    // "Today" semantics in a healthcare timezone-rich context are tricky:
    // a caregiver's local-day differs from the UTC-day that the backend
    // stamps. A naive `getFullYear/getMonth/getDate` compare against
    // `new Date()` misses any visit clocked-in late evening UTC that
    // is still "today" for an EDT caregiver, AND vice-versa. We use a
    // ±48h sliding window which is forgiving enough for any timezone
    // and small enough that a caregiver doesn't see ancient visits.
    const now = Date.now();
    const WINDOW_MS = 48 * 60 * 60 * 1000;
    const inWindow = (iso?: string | null): boolean => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && Math.abs(t - now) <= WINDOW_MS;
    };
    const enriched = (all ?? [])
      .filter(
        (v) =>
          inWindow(v.scheduledStartTime) ||
          inWindow(v.actualStartTime ?? v.startTime) ||
          inWindow(v.clockInTime),
      )
      .map((v): RayHealthMobileVisit => {
        // If the row only has clockInTime (typical for visits that have
        // started), derive scheduledStartTime/scheduledEndTime so the
        // existing mapRayHealthVisit + UI components can render.
        const start = v.scheduledStartTime ?? v.clockInTime ?? new Date().toISOString();
        const endIso =
          v.scheduledEndTime ??
          v.clockOutTime ??
          (v.clockInTime
            ? new Date(new Date(v.clockInTime).getTime() + 60 * 60 * 1000).toISOString()
            : start);
        return {
          ...v,
          scheduledStartTime: start,
          scheduledEndTime: endIso,
          ...(v.clockInTime && !v.actualStartTime ? { actualStartTime: v.clockInTime } : {}),
          ...(v.clockOutTime && !v.actualEndTime ? { actualEndTime: v.clockOutTime } : {}),
        };
      });
    const summary: Record<string, number> = { total: enriched.length };
    for (const v of enriched) {
      const key = String(v.status ?? 'unknown').toLowerCase();
      summary[key] = (summary[key] ?? 0) + 1;
    }
    return { visits: enriched, summary, serverTime: new Date().toISOString() };
  },

  /**
   * Backend has no `/mobile/visits/:id`. Reuse the agency-scoped list and
   * filter locally — fine for the single-caregiver case typical here.
   */
  async getVisitById(id: string): Promise<RayHealthMobileVisit> {
    const all = await request<RayHealthMobileVisit[]>('/evv/visits');
    const found = (all ?? []).find((v) => v.id === id);
    if (!found) {
      throw new RayHealthApiError('Visit not found', { status: 404 });
    }
    return found;
  },

  /**
   * No visit-specific tasks endpoint yet. `/tasks` returns the Pennsylvania
   * task catalog — surface that as the task list for any visit so the UI
   * can render something meaningful.
   */
  async getVisitTasks(_id: string): Promise<RayHealthTask[]> {
    const tasks = await request<RayHealthTask[]>('/tasks');
    return tasks ?? [];
  },

  /**
   * `id` here is the assignment id (the schedule template assignment),
   * not a pre-existing visit id — the backend creates the visit row at
   * clock-in time. PA service code defaults to T1019 (Personal Care
   * Services, per 15 min — the most common Medicaid Waiver code in PA);
   * other valid codes per `paServiceCodes` are S5125 (Attendant Care),
   * T1004 (Nursing Aide), T1021 (Home Health Aide). UIs that need a
   * non-default code must thread `serviceCode` through to here.
   */
  async startVisit(
    id: string,
    body: {
      location: Record<string, unknown>;
      deviceInfo: Record<string, unknown>;
      serviceCode?: string;
    },
  ): Promise<void> {
    await request<unknown>('/evv/clock-in', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: id,
        location: body.location,
        serviceCode: body.serviceCode ?? 'T1019',
      }),
    });
  },

  /**
   * `id` here IS the visit id (created by clock-in). Backend ignores
   * `notes` today; the EVV route only persists location + clock-out time.
   */
  async endVisit(
    id: string,
    body: {
      location: Record<string, unknown>;
      deviceInfo: Record<string, unknown>;
      notes?: string;
    },
  ): Promise<void> {
    await request<unknown>(`/evv/clock-out/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ location: body.location }),
    });
  },

  /**
   * No-op until the backend exposes `/mobile/device/register`. Devices
   * are tracked server-side via the `mobile_sessions` row created at
   * `/auth/mobile/login`, which is sufficient for revoke-on-loss.
   */
  async registerDevice(): Promise<void> {
    return;
  },

  persistLogin(result: RayHealthLoginResult) {
    const session = buildSessionFromLogin(result);
    saveSession(session);
    return session;
  },

  updateSessionProfile(partial: {
    firstName?: string;
    lastName?: string;
    email?: string;
    photoURL?: string;
  }) {
    const next = updateStoredSession({
      user: {
        ...(partial.firstName !== undefined ? { firstName: partial.firstName } : {}),
        ...(partial.lastName !== undefined ? { lastName: partial.lastName } : {}),
        ...(partial.email !== undefined ? { email: partial.email } : {}),
      },
      ...(partial.photoURL !== undefined ? { photoURL: partial.photoURL } : {}),
    });
    return next;
  },
};
