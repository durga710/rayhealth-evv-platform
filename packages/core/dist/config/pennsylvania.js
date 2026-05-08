export const pennsylvaniaOperatingTracks = ['personal-assistance', 'home-health'];
export const paCredentialTypes = ['tb-screening', 'background-check', 'license', 'training'];
export const paCredentialStatuses = ['active', 'expired', 'pending'];
export const paAssignmentStatuses = ['scheduled', 'completed', 'cancelled'];
export const paExceptionTypes = ['late-clock-in', 'missing-location', 'telephony-fallback', 'manual-entry'];
export const paCaregiverStatuses = ['active', 'inactive', 'suspended'];
const ROLE_CAPABILITIES = {
    admin: [
        'agency.read', 'agency.write',
        'staff.read', 'staff.write',
        'client.read', 'client.write',
        'schedule.read', 'schedule.write',
        'auth.read', 'auth.write'
    ],
    coordinator: [
        'agency.read',
        'staff.read',
        'client.read', 'client.write',
        'schedule.read', 'schedule.write'
    ],
    caregiver: [
        'schedule.read'
    ],
    family: [
        'client.read',
        'schedule.read'
    ]
};
export function hasCapability(role, capability) {
    return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
//# sourceMappingURL=pennsylvania.js.map