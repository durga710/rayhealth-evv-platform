import { z } from 'zod';

export const evvVisitIdSchema = z.string().uuid();

/**
 * Platform-attested integrity signals attached to a GPS reading.
 *
 * All fields are optional because older mobile clients won't send them.
 * The server's mock-location detector treats absence as "unknown", not "clean".
 *
 * - `isMock`: Android Location.isMock() / isFromMockProvider() — true means
 *   the OS itself told us the reading came from a mock provider.
 * - `isSimulator`: iOS — true when the device is the iOS Simulator. Real
 *   caregiver shifts should never be clocked from a simulator.
 * - `provider`: Android provider string (`gps` / `fused` / `network`) or
 *   `'ios'` for CLLocationManager readings. Useful for audit.
 * - `altitude` / `speed` / `heading`: optional motion telemetry. Used by
 *   the heuristic detector to spot synthetic readings (e.g. perfect zeros).
 */
export const locationIntegritySchema = z.object({
  isMock: z.boolean().optional(),
  isSimulator: z.boolean().optional(),
  provider: z.string().max(32).optional(),
  altitude: z.number().finite().optional(),
  speed: z.number().finite().nonnegative().optional(),
  heading: z.number().finite().min(0).max(360).optional()
});

export type LocationIntegrity = z.infer<typeof locationIntegritySchema>;

export const evvClockLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative(),
  integrity: locationIntegritySchema.optional()
});

export type EvvClockLocation = z.infer<typeof evvClockLocationSchema>;

export const evvClockInInputSchema = z.object({
  assignmentId: z.string().uuid(),
  location: evvClockLocationSchema
});

export const evvClockOutInputSchema = z.object({
  location: evvClockLocationSchema
});

export const evvVisitSchema = z.object({
  id: evvVisitIdSchema.optional(),
  assignmentId: z.string().uuid(),
  caregiverId: z.string().uuid(),
  clockInTime: z.string().datetime(),
  clockOutTime: z.string().datetime().optional(),
  clockInLocation: evvClockLocationSchema,
  clockOutLocation: evvClockLocationSchema.optional(),
  status: z.enum(['pending', 'verified', 'flagged']).default('pending')
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
