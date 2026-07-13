import type { AppRole } from '@rayhealth/core';
export declare const TEST_MOBILE_JTI = "00000000-0000-4000-8000-000000000099";
export declare function setTestJwtSecret(): void;
export declare function makeToken(role: AppRole, agencyId?: string, userId?: string, caregiverId?: string, tokenJti?: string | null): string;
//# sourceMappingURL=test-helpers.d.ts.map