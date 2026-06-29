import { z } from 'zod';
import { paServiceCodes } from '../config/pennsylvania.js';

export const authorizationSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid().or(z.string().min(1)),
  payerId: z.string().uuid().or(z.string().min(1)),
  unitsAuthorized: z.number().positive(),
  // Must be a canonical PA HCPCS code. EVV visits and 837 claim lines only
  // carry these codes (evv_visits_service_code_check enforces the same set),
  // so an authorization in any other code (e.g. the W-series program codes)
  // would never match a visit and its units would never burn down.
  serviceCode: z.enum(paServiceCodes),
  startDate: z.string().date(),
  endDate: z.string().date()
});

export type Authorization = z.infer<typeof authorizationSchema>;

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().date(),
  medicaidNumber: z.string().min(10).optional(),
  // Service address + GPS anchor for EVV geofencing. All optional so existing
  // callers and imports keep working, but when latitude/longitude are present
  // the clock-in / clock-out geofence gate can actually validate location
  // instead of failing open. geofenceRadiusM defaults to 150m at the DB level.
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  postalCode: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusM: z.number().int().positive().max(100_000).optional()
});

export type Client = z.infer<typeof clientSchema>;
