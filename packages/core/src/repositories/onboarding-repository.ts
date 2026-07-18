import type { Knex } from 'knex';
import type {
  Applicant,
  OnboardingInterview,
  OnboardingDocument,
  InterviewMessage,
} from '../domain/onboarding.js';

export class OnboardingRepository {
  constructor(private readonly db: Knex) {}

  // ── Applicant methods ─────────────────────────────────────────────────

  async createApplicant(data: Omit<Applicant, 'id' | 'appliedAt' | 'updatedAt'>): Promise<Applicant> {
    const [row] = await this.db('applicants')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: data.agencyId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        position: data.position ?? 'Direct Support Associate',
        cover_message: data.coverMessage ?? null,
        status: data.status ?? 'applied',
        admin_notes: data.adminNotes ?? null,
      })
      .returning('*');
    return this.mapApplicant(row);
  }

  /**
   * Records that an applicant affirmatively accepted the Terms of Service when
   * they submitted their application. Called once, right after createApplicant.
   */
  async recordTermsAcceptance(applicantId: string, version: string): Promise<void> {
    await this.db('applicants')
      .where({ id: applicantId })
      .update({ terms_accepted_at: this.db.fn.now(), terms_version: version });
  }

  async findApplicantById(id: string, agencyId: string): Promise<Applicant | null> {
    const row = await this.db('applicants').where({ id, agency_id: agencyId }).first();
    return row ? this.mapApplicant(row) : null;
  }

  async listApplicants(agencyId: string, status?: string): Promise<Applicant[]> {
    let query = this.db('applicants').where({ agency_id: agencyId });
    if (status) {
      query = query.where({ status });
    }
    const rows = await query.orderBy('applied_at', 'desc');
    return rows.map((r: Record<string, unknown>) => this.mapApplicant(r));
  }

  async updateApplicantStatus(
    id: string,
    agencyId: string,
    status: Applicant['status'],
    adminNotes?: string
  ): Promise<Applicant | null> {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (adminNotes !== undefined) {
      patch.admin_notes = adminNotes;
    }
    const [row] = await this.db('applicants')
      .where({ id, agency_id: agencyId })
      .update(patch)
      .returning('*');
    return row ? this.mapApplicant(row) : null;
  }

  // ── Interview methods ─────────────────────────────────────────────────

  async createInterview(applicantId: string, sessionToken: string): Promise<OnboardingInterview> {
    const [row] = await this.db('onboarding_interviews')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        applicant_id: applicantId,
        session_token: sessionToken,
        messages: JSON.stringify([]),
        status: 'pending',
      })
      .returning('*');
    return this.mapInterview(row);
  }

  async getInterviewByToken(token: string): Promise<OnboardingInterview | null> {
    const row = await this.db('onboarding_interviews').where({ session_token: token }).first();
    return row ? this.mapInterview(row) : null;
  }

  async updateInterview(
    id: string,
    patch: {
      messages?: InterviewMessage[];
      ai_summary?: string;
      ai_score?: number;
      status?: OnboardingInterview['status'];
      started_at?: string;
      completed_at?: string;
    }
  ): Promise<OnboardingInterview | null> {
    const update: Record<string, unknown> = {};
    if (patch.messages !== undefined) update.messages = JSON.stringify(patch.messages);
    if (patch.ai_summary !== undefined) update.ai_summary = patch.ai_summary;
    if (patch.ai_score !== undefined) update.ai_score = patch.ai_score;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.started_at !== undefined) update.started_at = patch.started_at;
    if (patch.completed_at !== undefined) update.completed_at = patch.completed_at;

    const [row] = await this.db('onboarding_interviews')
      .where({ id })
      .update(update)
      .returning('*');
    return row ? this.mapInterview(row) : null;
  }

  async getInterviewByApplicant(applicantId: string): Promise<OnboardingInterview | null> {
    const row = await this.db('onboarding_interviews').where({ applicant_id: applicantId }).first();
    return row ? this.mapInterview(row) : null;
  }

  // ── Document methods ──────────────────────────────────────────────────

  async requestDocument(
    applicantId: string,
    documentType: OnboardingDocument['documentType']
  ): Promise<OnboardingDocument> {
    const [row] = await this.db('onboarding_documents')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        applicant_id: applicantId,
        document_type: documentType,
        status: 'requested',
      })
      .returning('*');
    return this.mapDocument(row);
  }

  async updateDocumentStatus(
    docId: string,
    agencyId: string,
    status: OnboardingDocument['status'],
    verifiedByUserId?: string
  ): Promise<OnboardingDocument | null> {
    const patch: Record<string, unknown> = { status };
    if (status === 'verified') {
      patch.verified_at = new Date().toISOString();
      if (verifiedByUserId) patch.verified_by_user_id = verifiedByUserId;
    }
    if (status === 'submitted') {
      patch.submitted_at = new Date().toISOString();
    }

    // Tenant-scope: only update if the doc belongs to an applicant of this agency.
    // Knex JOIN+UPDATE+RETURNING with table aliases generates invalid SQL in PostgreSQL,
    // so we use a subquery instead.
    const [row] = await this.db('onboarding_documents')
      .where('id', docId)
      .whereIn(
        'applicant_id',
        this.db('applicants').select('id').where('agency_id', agencyId)
      )
      .update(patch)
      .returning('*');
    return row ? this.mapDocument(row) : null;
  }

  async listDocuments(applicantId: string): Promise<OnboardingDocument[]> {
    const rows = await this.db('onboarding_documents')
      .where({ applicant_id: applicantId })
      // Never select file_data here , listings carry metadata only.
      .select(
        'id', 'applicant_id', 'document_type', 'status', 'notes', 'requested_at',
        'submitted_at', 'verified_at', 'verified_by_user_id', 'created_at',
        'file_name', 'content_type', 'file_size',
      )
      .orderBy('requested_at', 'asc');
    return rows.map((r: Record<string, unknown>) => this.mapDocument(r));
  }

  // ── Applicant portal (token-scoped, public) ───────────────────────────

  /**
   * Everything the applicant portal needs, resolved from the interview
   * session token (the applicant's only credential): who they are, which
   * agency they applied to, interview progress, and their document checklist.
   */
  async getPortalByToken(token: string): Promise<{
    applicant: Applicant;
    agencyName: string;
    interview: OnboardingInterview;
    documents: OnboardingDocument[];
  } | null> {
    const interview = await this.getInterviewByToken(token);
    if (!interview) return null;
    const row = (await this.db('applicants as ap')
      .join('agencies as ag', 'ag.id', 'ap.agency_id')
      .where('ap.id', interview.applicantId)
      .select('ap.*', 'ag.name as agency_name')
      .first()) as Record<string, unknown> | undefined;
    if (!row) return null;
    const documents = await this.listDocuments(interview.applicantId);
    return {
      applicant: this.mapApplicant(row),
      agencyName: row.agency_name as string,
      interview,
      documents,
    };
  }

  /**
   * Store an uploaded document from the applicant portal. Only documents in
   * 'requested' or 'rejected' state accept an upload (a submitted/verified
   * file must not be silently replaced), and the document must belong to the
   * given applicant , the token authorizes exactly one applicant's checklist.
   */
  async submitDocumentFile(
    docId: string,
    applicantId: string,
    file: { fileName: string; contentType: string; data: Buffer },
  ): Promise<OnboardingDocument | null> {
    const [row] = await this.db('onboarding_documents')
      .where({ id: docId, applicant_id: applicantId })
      .whereIn('status', ['requested', 'rejected'])
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        file_name: file.fileName,
        content_type: file.contentType,
        file_size: file.data.length,
        file_data: file.data,
      })
      .returning([
        'id', 'applicant_id', 'document_type', 'status', 'notes', 'requested_at',
        'submitted_at', 'verified_at', 'verified_by_user_id', 'created_at',
        'file_name', 'content_type', 'file_size',
      ]);
    return row ? this.mapDocument(row) : null;
  }

  /** The stored file for admin review, tenant-scoped through the applicant. */
  async getDocumentFile(
    docId: string,
    agencyId: string,
  ): Promise<{ fileName: string; contentType: string; data: Buffer } | null> {
    const row = (await this.db('onboarding_documents as d')
      .join('applicants as ap', 'ap.id', 'd.applicant_id')
      .where('d.id', docId)
      .andWhere('ap.agency_id', agencyId)
      .select('d.file_name', 'd.content_type', 'd.file_data')
      .first()) as
      | { file_name?: string | null; content_type?: string | null; file_data?: Buffer | null }
      | undefined;
    if (!row?.file_data) return null;
    return {
      fileName: row.file_name ?? 'document',
      contentType: row.content_type ?? 'application/octet-stream',
      data: row.file_data,
    };
  }

  // ── Private mappers ───────────────────────────────────────────────────

  private mapApplicant(row: Record<string, unknown>): Applicant {
    return {
      id: row.id as string,
      agencyId: row.agency_id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: (row.phone as string | null) ?? undefined,
      position: row.position as string,
      coverMessage: (row.cover_message as string | null) ?? undefined,
      status: row.status as Applicant['status'],
      appliedAt:
        row.applied_at instanceof Date
          ? row.applied_at.toISOString()
          : (row.applied_at as string | undefined),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : (row.updated_at as string | undefined),
      adminNotes: (row.admin_notes as string | null) ?? undefined,
    };
  }

  private mapInterview(row: Record<string, unknown>): OnboardingInterview {
    let messages: InterviewMessage[] = [];
    try {
      const raw = row.messages;
      if (typeof raw === 'string') {
        messages = JSON.parse(raw) as InterviewMessage[];
      } else if (Array.isArray(raw)) {
        messages = raw as InterviewMessage[];
      }
    } catch {
      messages = [];
    }

    return {
      id: row.id as string,
      applicantId: row.applicant_id as string,
      sessionToken: row.session_token as string,
      messages,
      aiSummary: (row.ai_summary as string | null) ?? undefined,
      aiScore: (row.ai_score as number | null) ?? undefined,
      status: row.status as OnboardingInterview['status'],
      startedAt:
        row.started_at instanceof Date
          ? row.started_at.toISOString()
          : (row.started_at as string | null) ?? undefined,
      completedAt:
        row.completed_at instanceof Date
          ? row.completed_at.toISOString()
          : (row.completed_at as string | null) ?? undefined,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : (row.created_at as string | null) ?? undefined,
    };
  }

  private mapDocument(row: Record<string, unknown>): OnboardingDocument {
    return {
      id: row.id as string,
      applicantId: row.applicant_id as string,
      documentType: row.document_type as OnboardingDocument['documentType'],
      status: row.status as OnboardingDocument['status'],
      notes: (row.notes as string | null) ?? undefined,
      requestedAt:
        row.requested_at instanceof Date
          ? row.requested_at.toISOString()
          : (row.requested_at as string | null) ?? undefined,
      submittedAt:
        row.submitted_at instanceof Date
          ? row.submitted_at.toISOString()
          : (row.submitted_at as string | null) ?? undefined,
      verifiedAt:
        row.verified_at instanceof Date
          ? row.verified_at.toISOString()
          : (row.verified_at as string | null) ?? undefined,
      verifiedByUserId: (row.verified_by_user_id as string | null) ?? undefined,
      fileName: (row.file_name as string | null) ?? undefined,
      contentType: (row.content_type as string | null) ?? undefined,
      fileSize: (row.file_size as number | null) ?? undefined,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : (row.created_at as string | null) ?? undefined,
    };
  }
}
