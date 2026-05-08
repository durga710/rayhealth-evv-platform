export function authContext(req, _res, next) {
    req.auth = {
        agencyId: req.header('x-agency-id') ?? '',
        role: (req.header('x-user-role') ?? 'caregiver'),
        userId: req.header('x-user-id')
    };
    next();
}
//# sourceMappingURL=auth-context.js.map