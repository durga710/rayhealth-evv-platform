/**
 * Which signed-in accounts get testing conveniences (like skipping the
 * training-video watch requirement)? Only the App Store fixture agencies and
 * admin-role sessions. Real caregivers in real agencies never see these.
 */

/** Deterministic fixture agency ids (Sunrise + Keystone demo agencies). */
export const FIXTURE_AGENCY_IDS = new Set([
  'e1c4a7e3-1cad-4001-8e0a-000000000001',
  'b2000000-0000-4000-8000-000000000099',
]);

export function isTestingAccount(user: { agencyId?: string; role?: string } | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.agencyId != null && FIXTURE_AGENCY_IDS.has(user.agencyId);
}
