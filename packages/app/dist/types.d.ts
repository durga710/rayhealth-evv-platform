import type { AppRole } from '@rayhealth/core';
export interface AuthContext {
    agencyId: string;
    role: AppRole;
    userId?: string;
    caregiverId?: string;
}
declare global {
    namespace Express {
        interface Request {
            auth: AuthContext;
        }
    }
}
//# sourceMappingURL=types.d.ts.map