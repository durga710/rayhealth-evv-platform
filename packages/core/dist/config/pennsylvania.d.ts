export declare const pennsylvaniaOperatingTracks: readonly ["personal-assistance", "home-health"];
export declare const paCredentialTypes: readonly ["tb-screening", "background-check", "license", "training"];
export declare const paCredentialStatuses: readonly ["active", "expired", "pending"];
export declare const paAssignmentStatuses: readonly ["scheduled", "completed", "cancelled"];
export declare const paExceptionTypes: readonly ["late-clock-in", "missing-location", "telephony-fallback", "manual-entry"];
export declare const paCaregiverStatuses: readonly ["active", "inactive", "suspended"];
export type PaCredentialType = typeof paCredentialTypes[number];
export type PaExceptionType = typeof paExceptionTypes[number];
export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';
export type Capability = 'agency.read' | 'agency.write' | 'staff.read' | 'staff.write' | 'client.read' | 'client.write' | 'schedule.read' | 'schedule.write' | 'auth.read' | 'auth.write';
export declare function hasCapability(role: AppRole, capability: Capability): boolean;
//# sourceMappingURL=pennsylvania.d.ts.map