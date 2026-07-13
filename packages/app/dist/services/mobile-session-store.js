import { MobileSessionRepository } from '@rayhealth/core';
export function getMobileSessionStore(req) {
    return (req.app.get('mobileSessionStore') ??
        new MobileSessionRepository(req.app.get('db')));
}
//# sourceMappingURL=mobile-session-store.js.map