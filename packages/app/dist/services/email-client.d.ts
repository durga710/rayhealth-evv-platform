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
export declare class EmailNotConfiguredError extends Error {
    constructor();
}
export declare class EmailSendError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export interface SendEmailInput {
    /** Recipient email address. */
    to: string;
    /** Subject line, plain text. */
    subject: string;
    /** Plain-text body. Sent as `text` in the Resend payload. */
    text: string;
    /** Optional HTML body — falls back to the text body if not supplied. */
    html?: string;
    /** Optional tags for filtering in Resend logs. */
    tags?: Array<{
        name: string;
        value: string;
    }>;
}
export interface SendEmailOutput {
    /** Resend message id, used as a correlation key in audit logs. */
    id: string;
}
export declare function isEmailConfigured(): boolean;
export declare function sendEmail(input: SendEmailInput): Promise<SendEmailOutput>;
//# sourceMappingURL=email-client.d.ts.map