/**
 * Caregiver reminder email — HTML + plain-text.
 *
 * Sent when an admin/coordinator confirms a copilot `send_reminder` action.
 * The body is the human-authored reminder message (escaped); RayHealth only
 * wraps it in branded chrome. No PHI is added by the template.
 */
export interface ReminderEmailFields {
    caregiverName: string;
    /** The reminder body the admin confirmed sending. */
    message: string;
    agencyName: string;
    supportEmail?: string;
}
export interface ReminderEmailPayload {
    subject: string;
    html: string;
    text: string;
}
export declare function renderReminderEmail(fields: ReminderEmailFields): ReminderEmailPayload;
//# sourceMappingURL=reminder-email.d.ts.map