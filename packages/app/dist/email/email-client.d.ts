/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Currently backed by Amazon SES via `@aws-sdk/client-sesv2`. The route
 * layer talks to `EmailClient`, not the underlying provider, so swapping
 * providers later is a one-file change.
 *
 * Failure model — by design we NEVER throw:
 *  - If AWS credentials are unset, `createEmailClient()` returns a no-op
 *    implementation that resolves with `{ ok: false, error: 'EMAIL_NOT_CONFIGURED' }`.
 *    This keeps local dev / unconfigured preview deploys functional —
 *    the admin can still copy the invite URL from the response and share
 *    it manually.
 *  - If the SES call throws (network, throttling, unverified sender, etc.)
 *    we catch the error, log it (scrubbed by `safeError`), and return
 *    `{ ok: false, error: '<category>' }`. The route layer surfaces this
 *    as `emailDelivery: 'failed'`.
 *
 * Why the SDK and not raw HTTP — SES requires AWS SigV4 signing on every
 * request, which is non-trivial to implement correctly. `@aws-sdk/client-sesv2`
 * handles signing, retries, and region resolution for us.
 */
export interface InviteEmailParams {
    to: string;
    inviteUrl: string;
    agencyName: string;
    role: string;
    /** ISO-8601 timestamp the invite expires. */
    expiresAt: string;
    invitedByName?: string;
}
export type SendEmailResult = {
    ok: true;
    id: string;
} | {
    ok: false;
    error: string;
};
export interface EmailClient {
    sendInviteEmail(params: InviteEmailParams): Promise<SendEmailResult>;
}
/**
 * Construct the appropriate `EmailClient` for the current environment.
 *
 * Reads env vars at call time (not at module load) so test setup can
 * mutate `process.env` between cases. Credentials may come from:
 *  - Explicit `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` env vars
 *    (the path Vercel will use — set these in project env).
 *  - The default AWS provider chain (IAM role, ~/.aws/credentials, etc.)
 *    when running locally / on EC2. The SDK handles that natively if the
 *    explicit env vars are absent but the chain has creds.
 *
 * To disable email entirely (no-op fallback), unset
 * `AWS_ACCESS_KEY_ID` AND `AWS_SECRET_ACCESS_KEY`. The route layer will
 * return `emailDelivery: 'not_configured'` and the admin's manual-copy
 * fallback still works.
 */
export declare function createEmailClient(): EmailClient;
/**
 * Build the absolute invite URL the recipient will click.
 *
 * Resolution order:
 *  1. Explicit `INVITE_URL_BASE` env (preferred — set in Vercel to
 *     `https://rayhealthevv.com` or your custom domain).
 *  2. `APP_URL` env (already used elsewhere in the codebase).
 *  3. `BASE_URL` env (last fallback before localhost).
 *  4. `http://localhost:5173` for local dev.
 */
export declare function buildInviteUrl(inviteId: string): string;
//# sourceMappingURL=email-client.d.ts.map