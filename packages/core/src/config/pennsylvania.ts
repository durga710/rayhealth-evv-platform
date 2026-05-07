export const pennsylvaniaOperatingTracks = ['personal-assistance', 'home-health'] as const;

export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';

export type Capability = 
  | 'agency.read' | 'agency.write'
  | 'staff.read' | 'staff.write'
  | 'client.read' | 'client.write'
  | 'schedule.read' | 'schedule.write'
  | 'auth.read' | 'auth.write';

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
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

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
