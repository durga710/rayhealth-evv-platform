/**
 * Email client — thin wrapper around the Resend REST API.
 *
 * Uses fetch + RESEND_API_KEY env var. No SDK dep. Same pattern as the
 * gemini-client — keeps the platform package's dep tree small and avoids
 * version-skew issues with vendor SDKs.
 *
 * Required env vars:
 *   RESEND_API_KEY        — sk-... from https://resend.com/api-keys
 *   RESEND_FROM_ADDRESS   — verified sender, e.g. "RayHealth <noreply@send.rayhealthevv.com>"
 *   RESEND_REPLY_TO       — optional reply-to address (defaults to FROM)
 *
 * BAA status: production must have an executed Resend BAA before emails
 * referencing PHI (visit data, client names) are sent. Invitation emails
 * contain caregiver email + agency name — agency name alone is borderline,
 * caregiver email is identifying. Send BAA request from
 * docs/compliance/hipaa/BAA_REQUEST_EMAILS.md §4 before going live with
 * real caregivers.
 */
const RESEND_API_BASE = 'https://api.resend.com';
export class EmailNotConfiguredError extends Error {
    constructor() {
        super('RESEND_API_KEY is not set; cannot send email.');
        this.name = 'EmailNotConfiguredError';
    }
}
export class EmailSendError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'EmailSendError';
    }
}
export function isEmailConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_ADDRESS);
}
export async function sendEmail(input) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_ADDRESS;
    if (!apiKey || !from) {
        throw new EmailNotConfiguredError();
    }
    const replyTo = process.env.RESEND_REPLY_TO;
    const response = await fetch(`${RESEND_API_BASE}/emails`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            html: input.html ?? undefined,
            reply_to: replyTo ?? undefined,
            tags: input.tags,
        }),
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => ({})));
        throw new EmailSendError(response.status, body.message ?? `Resend returned ${response.status}`);
    }
    const body = (await response.json());
    if (!body.id) {
        throw new EmailSendError(response.status, 'Resend response missing id');
    }
    return { id: body.id };
}
//# sourceMappingURL=email-client.js.map