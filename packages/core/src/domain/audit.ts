import { z } from 'zod';

export const auditEventTypes = [
  'visit.created', 'visit.clock-out', 'visit.approved', 'visit.flagged',
  'credential.created', 'credential.expired', 'credential.renewed',
  'caregiver.created', 'caregiver.status-changed',
  'assignment.created', 'assignment.cancelled',
  'exception.filed', 'exception.approved',
] as const;

export const auditEventSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  actorId: z.string().uuid(),
  eventType: z.enum(auditEventTypes),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime().optional(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventType = typeof auditEventTypes[number];
