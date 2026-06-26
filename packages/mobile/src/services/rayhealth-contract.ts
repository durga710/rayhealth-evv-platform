import type { User, Visit } from '../types';

type ImportMetaEnvLike = {
  VITE_PARENT_API_URL?: string;
  PARENT_API_URL?: string;
};

export interface PullChangesQueryOptions {
  lastPulledAt: number;
  entities: string[];
  organizationId: string;
  branchId?: string;
  caregiverId?: string;
  limit?: number;
}

export interface RayHealthLoginUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  organizationId: string;
}

export interface RayHealthLoginResult {
  user: RayHealthLoginUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface RayHealthInviteDetails {
  token: string;
  accessCode: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string;
  organizationId: string;
  roles: string[];
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  isValid: boolean;
}

export interface RayHealthAcceptInviteRequest {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
}

export interface RayHealthTask {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  scheduledTime?: string;
  scheduled_time?: string;
  status?: string;
  completionNote?: string;
  completion_note?: string;
}

export interface RayHealthMobileVisit {
  id: string;
  caregiverId?: string;
  assignedCaregiverId?: string;
  clientName?: string;
  patientName?: string;
  clientAddress?: RayHealthAddress | string;
  patientAddress?: RayHealthAddress | string;
  address?: RayHealthAddress | string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  startTime?: string;
  endTime?: string;
  status: string;
  completionNotes?: string;
  documentation?: string;
}

export interface RayHealthAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Row shape returned by the platform's `GET /mobile/caregiver/today`.
 * Matches the camelCase output of `ScheduleRepository.getTodaysScheduleForCaregiver`.
 * `currentVisit*` fields are populated when the caregiver has already
 * clocked into THIS assignment today (used by the dashboard to short-
 * circuit a stale "you're already clocked in" state without a separate
 * round-trip to /evv/visits).
 */
export interface TodayScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  clientAddressLine1: string | null;
  clientCity: string | null;
  clientState: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  templateId: string;
  templateName: string;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

export interface TodayScheduleResponse {
  schedule: TodayScheduleRow[];
  serverTime: string;
}

export function getRayHealthApiBaseUrl(explicitBaseUrl?: string): string {
  const env = ((import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env ?? {}) as ImportMetaEnvLike;
  const configuredBaseUrl =
    explicitBaseUrl ??
    env.VITE_PARENT_API_URL ??
    env.PARENT_API_URL ??
    'https://rayhealthevv.com/api';

  return configuredBaseUrl.replace(/\/+$/, '');
}

export function buildPullChangesQuery(options: PullChangesQueryOptions): string {
  const params = new URLSearchParams({
    lastPulledAt: String(options.lastPulledAt),
    entities: options.entities.join(','),
    organizationId: options.organizationId,
  });

  if (options.branchId) {
    params.set('branchId', options.branchId);
  }
  if (options.caregiverId) {
    params.set('caregiverId', options.caregiverId);
  }
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }

  return params.toString();
}

export function mapRolesToMobileRole(roles: string[]): User['role'] {
  if (roles.includes('CAREGIVER')) {
    return 'caregiver';
  }

  if (roles.some((role) => ['SUPER_ADMIN', 'ORG_ADMIN'].includes(role))) {
    return 'admin';
  }

  if (roles.some((role) => ['BRANCH_ADMIN', 'COORDINATOR', 'SUPERVISOR'].includes(role))) {
    return 'supervisor';
  }

  return 'caregiver';
}

export function mapRayHealthUser(user: RayHealthLoginUser): User {
  const [firstName = '', ...rest] = user.name.trim().split(/\s+/);
  return {
    id: user.id,
    email: user.email,
    firstName,
    lastName: rest.join(' '),
    role: mapRolesToMobileRole(user.roles),
    organizationId: user.organizationId,
  };
}

function formatAddress(address: RayHealthAddress | string | undefined): string {
  if (typeof address === 'string') {
    return address;
  }

  if (!address) {
    return '';
  }

  const segments = [address.line1, address.line2, address.city, address.state, address.postalCode]
    .filter((segment): segment is string => typeof segment === 'string' && segment.trim().length > 0)
    .map((segment) => segment.trim());

  if (segments.length === 0) {
    return '';
  }

  const [line1 = '', line2 = '', city = '', state = '', postalCode = ''] = segments;
  if (city || state || postalCode) {
    const cityStatePostal = [city, state, postalCode].filter(Boolean).join(' ');
    return [line1, line2, cityStatePostal].filter(Boolean).join(', ');
  }

  return segments.join(', ');
}

function mapVisitStatus(status: string): Visit['status'] {
  switch (status) {
    // Predecessor / camel-case statuses kept for backward compatibility.
    case 'IN_PROGRESS':
    case 'PAUSED':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
    case 'REJECTED':
      return 'cancelled';
    case 'NO_SHOW_CAREGIVER':
      return 'missed';
    // rayhealth-evv-platform backend uses lowercase enum values from the
    // EvvVisit schema: 'pending' (clocked-in, not yet clocked-out),
    // 'verified' (both punches captured + within geo/time tolerance),
    // 'corrected' (visit_maintenance amended the row), 'cancelled'.
    case 'pending':
      return 'active';
    case 'verified':
    case 'corrected':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

export function mapRayHealthVisit(visit: RayHealthMobileVisit): Visit {
  const resolvedAddress =
    (visit.clientAddress as RayHealthAddress | string | undefined) ??
    (visit.patientAddress as RayHealthAddress | string | undefined) ??
    (visit.address as RayHealthAddress | string | undefined);

  const location =
    typeof resolvedAddress === 'object' && resolvedAddress !== null
      ? {
          latitude: Number(resolvedAddress.latitude ?? 0),
          longitude: Number(resolvedAddress.longitude ?? 0),
        }
      : undefined;

  return {
    id: visit.id,
    caregiverId: visit.caregiverId ?? visit.assignedCaregiverId ?? '',
    patientName: visit.clientName ?? visit.patientName ?? 'Client',
    patientAddress: formatAddress(resolvedAddress),
    scheduledStartTime: visit.scheduledStartTime,
    scheduledEndTime: visit.scheduledEndTime,
    status: mapVisitStatus(visit.status),
    ...((visit.actualStartTime ?? visit.startTime) ? { startTime: visit.actualStartTime ?? visit.startTime } : {}),
    ...((visit.actualEndTime ?? visit.endTime) ? { endTime: visit.actualEndTime ?? visit.endTime } : {}),
    ...((visit.completionNotes ?? visit.documentation)
      ? { documentation: visit.completionNotes ?? visit.documentation }
      : {}),
    ...(location && !Number.isNaN(location.latitude) && !Number.isNaN(location.longitude)
      ? { location }
      : {}),
  };
}

export function mapRayHealthTask(task: RayHealthTask): {
  id: string;
  label: string;
  category: string;
  completed: boolean;
  time?: string;
  note?: string;
} {
  return {
    id: task.id,
    label: task.name ?? task.description ?? 'Care task',
    category: task.category ?? 'Care Plan',
    completed: task.status === 'COMPLETED',
    time: task.scheduledTime ?? task.scheduled_time,
    note: task.completionNote ?? task.completion_note,
  };
}
