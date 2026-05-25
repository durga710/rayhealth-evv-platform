import { z } from 'zod';

export const auditEventTypes = [
  'visit.created', 'visit.clock-out', 'visit.approved', 'visit.flagged',
  'credential.created', 'credential.expired', 'credential.renewed',
  'caregiver.created', 'caregiver.status-changed',
  'assignment.created', 'assignment.cancelled',
  'exception.filed', 'exception.approved', 'exception.rejected',
  'auth.login.success', 'auth.login.failure', 'auth.logout',
  'session.created', 'session.revoked',
  'csrf.failure',
  'phi.read', 'phi.export',
  'request.write',
  'permission.denied',
  'learning.override',
  'learning.course.completed',
  'agency.profile.changed',
  'agency.feature.changed',
  'agency.evv-config.changed',
  'copilot.query',
  'copilot.action.proposed',
  'copilot.action.confirmed',
  'copilot.action.declined',
  'invite.created',
  'invite.resent',
  'invite.revoked',
  'invite.accepted',
  'invite.access_code_failed',
] as const;

export const auditOutcomes = ['success', 'failure', 'denied'] as const;
export const auditActorTypes = ['user', 'service', 'system'] as const;

export const auditEventSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorType: z.enum(auditActorTypes).default('user'),
  eventType: z.enum(auditEventTypes),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  outcome: z.enum(auditOutcomes).default('success'),
  correlationId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventType = typeof auditEventTypes[number];
