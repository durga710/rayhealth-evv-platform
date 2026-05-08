export declare const pennsylvaniaOperatingTracks: readonly ["personal-assistance", "home-health"];
export declare const paCredentialTypes: readonly ["tb-screening", "background-check", "license", "training"];
export declare const paCredentialStatuses: readonly ["active", "expired", "pending"];
export declare const paAssignmentStatuses: readonly ["scheduled", "completed", "cancelled"];
export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';
export type Capability = 'agency.read' | 'agency.write' | 'staff.read' | 'staff.write' | 'client.read' | 'client.write' | 'schedule.read' | 'schedule.write' | 'auth.read' | 'auth.write';
export declare function hasCapability(role: AppRole, capability: Capability): boolean;
//# sourceMappingURL=pennsylvania.d.ts.map