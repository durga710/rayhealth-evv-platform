/**
 * Provider-agnostic email client used by the invite flow.
 *
 * Backed by Amazon SES via `@aws-sdk/client-sesv2`. Set AWS_ACCESS_KEY_ID
 * and AWS_SECRET_ACCESS_KEY in Vercel environment variables to enable.
 *
 * When credentials are absent the client falls back to a no-op that returns
 * EMAIL_NOT_CONFIGURED — the admin can copy the invite link manually.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { renderInviteEmail } from './templates/invite-email.js';
import { safeError } from '../security/safe-log.js';
const DEFAULT_FROM = 'RayHealth <onboarding@www.rayhealthevv.com>';
const DEFAULT_REGION = 'us-east-1';
/**
 * Returns a no-op client. Used when AWS credentials are unset so callers
 * don't have to branch — they always get a working `sendInviteEmail` that
 * resolves with a "not configured" outcome.
 */
function createNoopClient() {
    return {
        async sendInviteEmail() {
            return { ok: false, error: 'EMAIL_NOT_CONFIGURED' };
        }
    };
}
/**
 * Categorize an SES SDK error into a short, log-safe string. The SDK
 * surfaces a `name` (e.g. `MessageRejected`, `MailFromDomainNotVerified`)
 * and sometimes an HTTP status code on `$metadata.httpStatusCode`. We
 * never include the human-readable `message` because it can echo the
 * recipient address or other request data.
 */
function categorizeSesError(err) {
    if (err && typeof err === 'object') {
        const e = err;
        const status = e.$metadata?.httpStatusCode;
        const name = e.name;
        if (name && status)
            return `HTTP_${status}:${name}`;
        if (name)
            return name;
        if (status)
            return `HTTP_${status}`;
    }
    return 'UNKNOWN_ERROR';
}
function createSesClient(client, from) {
    return {
        async sendInviteEmail(params) {
            const { subject, html, text } = renderInviteEmail({
                to: params.to,
                inviteUrl: params.inviteUrl,
                agencyName: params.agencyName,
                role: params.role,
                expiresAt: params.expiresAt,
                invitedByName: params.invitedByName
            });
            try {
                const result = await client.send(new SendEmailCommand({
                    FromEmailAddress: from,
                    Destination: { ToAddresses: [params.to] },
                    Content: {
                        Simple: {
                            Subject: { Data: subject, Charset: 'UTF-8' },
                            Body: {
                                Html: { Data: html, Charset: 'UTF-8' },
                                Text: { Data: text, Charset: 'UTF-8' }
                            }
                        }
                    }
                }));
                const id = result.MessageId;
                if (!id) {
                    safeError('ses.send returned ok without MessageId');
                    return { ok: false, error: 'NO_MESSAGE_ID' };
                }
                return { ok: true, id };
            }
            catch (err) {
                const category = categorizeSesError(err);
                safeError('ses.send failed', new Error(category));
                return { ok: false, error: category };
            }
        }
    };
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
export function createEmailClient() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    if (!accessKeyId || !secretAccessKey)
        return createNoopClient();
    const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
    const region = process.env.AWS_SES_REGION?.trim() || process.env.AWS_REGION?.trim() || DEFAULT_REGION;
    const client = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });
    return createSesClient(client, from);
}
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
export function buildInviteUrl(inviteId) {
    const base = (process.env.INVITE_URL_BASE ||
        process.env.APP_URL ||
        process.env.BASE_URL ||
        'http://localhost:5173').replace(/\/+$/, '');
    return `${base}/accept-invite?token=${encodeURIComponent(inviteId)}`;
}
//# sourceMappingURL=email-client.js.map