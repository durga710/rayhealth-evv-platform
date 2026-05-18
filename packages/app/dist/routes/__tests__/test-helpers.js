import jwt from 'jsonwebtoken';
const TEST_SECRET = 'test-secret-for-unit-tests';
export function setTestJwtSecret() {
    // Must be set before createApp() which validates JWT_SECRET at startup.
    process.env.JWT_SECRET = TEST_SECRET;
}
export function makeToken(role, agencyId = 'agency-1', userId = 'user-1', caregiverId) {
    return jwt.sign({ sub: userId, agencyId, role, caregiverId }, TEST_SECRET, {
        expiresIn: '1h',
        algorithm: 'HS256',
    });
}
//# sourceMappingURL=test-helpers.js.map