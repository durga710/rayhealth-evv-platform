import { z } from 'zod';
export declare const auditEventTypes: readonly ["visit.created", "visit.clock-out", "visit.approved", "visit.flagged", "credential.created", "credential.expired", "credential.renewed", "caregiver.created", "caregiver.status-changed", "assignment.created", "assignment.cancelled", "exception.filed", "exception.approved"];
export declare const auditEventSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    actorId: z.ZodString;
    eventType: z.ZodEnum<{
        "visit.created": "visit.created";
        "visit.clock-out": "visit.clock-out";
        "visit.approved": "visit.approved";
        "visit.flagged": "visit.flagged";
        "credential.created": "credential.created";
        "credential.expired": "credential.expired";
        "credential.renewed": "credential.renewed";
        "caregiver.created": "caregiver.created";
        "caregiver.status-changed": "caregiver.status-changed";
        "assignment.created": "assignment.created";
        "assignment.cancelled": "assignment.cancelled";
        "exception.filed": "exception.filed";
        "exception.approved": "exception.approved";
    }>;
    entityType: z.ZodString;
    entityId: z.ZodString;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventType = typeof auditEventTypes[number];
//# sourceMappingURL=audit.d.ts.map