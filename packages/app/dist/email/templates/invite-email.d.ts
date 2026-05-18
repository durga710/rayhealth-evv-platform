/**
 * Staff-invite email template — both HTML and plain-text payloads.
 *
 * Design rules:
 *  - Inline styles only. Outlook, Gmail, Yahoo all strip <style> blocks
 *    aggressively; table-based layout + inline CSS is the lowest common
 *    denominator that renders predictably across them.
 *  - No external resources (no <img src=...>, no remote fonts). The
 *    branded header uses background color + text only so it renders
 *    without "load remote content" approvals in Outlook / Apple Mail.
 *  - Plain-text version includes the URL inline for clients that don't
 *    render HTML (and for screen readers + accessibility).
 *  - Never embed any session token, API key, or PII beyond what the
 *    inviter explicitly typed (recipient email, agency name, role).
 *    The only sensitive value is the time-limited invite URL, which is
 *    the whole point of the email.
 */
export interface InviteEmailFields {
    /** Recipient name displayed in the greeting; falls back to "there" if unset. */
    to: string;
    /** Absolute URL the recipient clicks to accept (already URL-encoded by caller). */
    inviteUrl: string;
    /** Agency display name surfaced in subject + body. */
    agencyName: string;
    /** Role the recipient is being invited as (admin / coordinator / caregiver / family). */
    role: string;
    /** ISO-8601 timestamp the invite expires; the template formats for human display. */
    expiresAt: string;
    /** Optional display name of the inviter for personalization. */
    invitedByName?: string;
    /** Support contact rendered in the footer. */
    supportEmail?: string;
}
export interface InviteEmailPayload {
    subject: string;
    html: string;
    text: string;
}
export declare function renderInviteEmail(fields: InviteEmailFields): InviteEmailPayload;
//# sourceMappingURL=invite-email.d.ts.map