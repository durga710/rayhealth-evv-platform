import type { Request } from 'express';
import { MobileSessionRepository } from '@rayhealth/core';
export type MobileSessionStore = Pick<MobileSessionRepository, 'create' | 'findActiveByJti' | 'revokeByJti'>;
export declare function getMobileSessionStore(req: Request): MobileSessionStore;
//# sourceMappingURL=mobile-session-store.d.ts.map