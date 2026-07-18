import { z } from 'zod';

export const agencyThemeSchema = z.object({
  primaryColor: z.string().optional(),
  primaryDark: z.string().optional(),
  accentColor: z.string().optional(),
  logoText: z.string().optional(),
  tagline: z.string().optional(),
});

export type AgencyTheme = z.infer<typeof agencyThemeSchema>;

export const agencySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  state: z.string().refine((val) => val === 'PA', {
    message: 'Agency must be located in Pennsylvania'
  }),
  operatingTracks: z.array(z.enum(['personal-assistance', 'home-health'])).min(1),
  medicaidProviderNumber: z.string().min(6).optional()
});

export type Agency = z.infer<typeof agencySchema>;

// ── Public hiring page ──────────────────────────────────────────────────────

/**
 * Path segments the public agency page must never claim: every top-level SPA
 * route and API prefix. A slug colliding with one of these would shadow the
 * real page (rayhealthevv.com/<slug> is a catch-all route).
 */
export const RESERVED_PUBLIC_SLUGS = new Set([
  'api', 'admin', 'apply', 'applicant', 'interview', 'portal', 'login', 'signup', 'logout',
  'accept-invite', 'forgot-password', 'reset-password',
  'app', 'assets', 'static', 'settings', 'superadmin', 'support', 'terms',
  'privacy', 'about', 'pricing', 'product', 'platform', 'caregiver', 'evv',
  'scheduling', 'billing', 'compliance', 'learning', 'contact', 'blog', 'docs',
  // Live top-level marketing/product routes in App.tsx. Review finding: a
  // slug matching one of these saves fine but never renders (React Router
  // ranks static routes above /:slug), silently breaking the agency's page.
  // Keep this in sync when adding top-level routes.
  'demo', 'launch', 'ads', 'status', 'trust', 'rayverify',
  // First segments of multi-segment marketing routes: /solutions/* etc. have
  // no bare-segment static route, so /:slug would otherwise claim them.
  'solutions', 'resources',
]);

/** Lowercase letters, digits, hyphens; 3-60 chars; no leading/trailing hyphen. */
export const publicSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Slug may use lowercase letters, digits, and hyphens')
  .refine((s) => !RESERVED_PUBLIC_SLUGS.has(s), { message: 'This slug is reserved' });

/** Normalize user input ('CyanjelCareLLC' → 'cyanjelcarellc') before validation. */
export function normalizePublicSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}
