export function auditLog(req, _res, next) {
    // Simple console logger for now, in a real app would emit to an audit service
    if (req.method !== 'GET') {
        console.log(`[AUDIT] User ${req.auth.userId} in Agency ${req.auth.agencyId} performed ${req.method} on ${req.path}`);
    }
    next();
}
//# sourceMappingURL=audit-log.js.map