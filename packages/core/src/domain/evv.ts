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
  serviceCode: evvServiceCodeSchema.optional(),
  // Store-and-forward: when the mobile app captured this punch offline, the
  // original capture moment rides along at replay so the visit carries the
  // real punch time, not the sync time. The route bounds the window (no
  // future stamps beyond clock skew, nothing older than 72h).
  capturedAt: z.string().datetime().optional()
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
  note: z.string().trim().max(2000).optional(),
  // Store-and-forward capture time, see evvClockInInputSchema.capturedAt.
  capturedAt: z.string().datetime().optional()
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
  hhaexchangeConfirmationId: z.string().nullable().optional(),
  // Server insert time. For an offline store-and-forward punch this trails
  // clockInTime by the sync delay, making delayed submissions auditable
  // without a separate flag.
  createdAt: z.string().datetime().optional()
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
export type EvvClockInInput = z.infer<typeof evvClockInInputSchema>;
export type EvvClockOutInput = z.infer<typeof evvClockOutInputSchema>;
