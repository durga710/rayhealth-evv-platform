/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Backed by Amazon SES via `@aws-sdk/client-sesv2`. Set AWS_ACCESS_KEY_ID
 * and AWS_SECRET_ACCESS_KEY in Vercel environment variables to enable.
 *
 * When credentials are absent the client falls back to a no-op that returns
 * EMAIL_NOT_CONFIGURED — the admin can copy the invite link manually.
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
 * Construct the SES email client from environment variables.
 *
 * Required Vercel env vars:
 *   AWS_ACCESS_KEY_ID      — IAM access key with ses:SendEmail permission
 *   AWS_SECRET_ACCESS_KEY  — matching IAM secret key
 *
 * Optional:
 *   EMAIL_FROM     — override sender (default: onboarding@www.rayhealthevv.com)
 *   AWS_SES_REGION — override region (default: us-east-1)
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