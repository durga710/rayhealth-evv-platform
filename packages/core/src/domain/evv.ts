import { z } from 'zod';
import { paServiceCodes } from '../config/pennsylvania.js';

export const evvVisitIdSchema = z.string().uuid();
export const evvServiceCodeSchema = z.enum(paServiceCodes);

export const evvLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative()
});

export const evvClockInInputSchema = z.object({
  assignmentId: z.string().uuid(),
  location: evvLocationSchema,
  serviceCode: evvServiceCodeSchema.optional()
});

/**
 * A task documented as performed during a visit. Snapshotted from the PA
 * task catalog ({id, duty}) at clock-out so the visit row stands alone for
 * audit-packet and aggregator use, same philosophy as the Cures-Act
 * service-code/client snapshots taken at clock-in.
 */
export const evvVisitTaskSchema = z.object({
  id: z.string().min(1),
  duty: z.string().min(1)
});

export const evvClockOutInputSchema = z.object({
  location: evvLocationSchema,
  // Optional service documentation captured with the clock-out. taskIds are
  // PA task-catalog IDs; the route resolves them against paTasks and rejects
  // unknown codes, so the DB only ever stores catalog-backed snapshots.
  taskIds: z.array(z.string().min(1).max(16)).max(100).optional(),
  note: z.string().trim().max(2000).optional()
});

export const evvVisitSchema = z.object({
  id: z.string().uuid().optional(),
  assignmentId: z.string().uuid(),
  caregiverId: z.string().uuid(),
  // Cures-Act #2 (beneficiary), snapshotted onto the row at clock-in.
  clientId: z.string().uuid().optional(),
  // Cures-Act #1 (type of service). HCPCS code stamped at clock-in.
  serviceCode: evvServiceCodeSchema.optional(),
  clockInTime: z.string().datetime(),
  clockOutTime: z.string().datetime().optional(),
  clockInLocation: evvLocationSchema,
  clockOutLocation: evvLocationSchema.optional(),
  status: z.enum(['pending', 'verified', 'flagged']).default('pending'),
  // Service documentation recorded at clock-out: catalog-snapshotted tasks
  // performed and a free-text note. Null/absent on visits documented before
  // this feature or when the caregiver skipped documentation.
  tasks: z.array(evvVisitTaskSchema).nullable().optional(),
  visitNote: z.string().nullable().optional(),
  // Aggregator submission lifecycle. Null until the background job first
  // attempts submission; 'accepted' means Sandata returned a confirmation ID.
  sandataStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  sandataConfirmationId: z.string().nullable().optional(),
  // HHAeXchange analogue of the Sandata pair above, for agencies routed
  // through that aggregator instead.
  hhaexchangeStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  hhaexchangeConfirmationId: z.string().nullable().optional()
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
export type EvvClockInInput = z.infer<typeof evvClockInInputSchema>;
export type EvvClockOutInput = z.infer<typeof evvClockOutInputSchema>;
