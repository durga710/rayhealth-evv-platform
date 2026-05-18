import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';
import type { VisitMaintenance } from '../domain/visit-maintenance.js';

interface VisitMaintenanceRow {
  id: string;
  visit_id: string;
  agency_id: string | null;
  requester_id: string;
  reason: string;
  reason_category_code: string | null;
  correction_code: string | null;
  originator_role: string | null;
  original_start_time: Date | string | null;
  original_end_time: Date | string | null;
  adjusted_start_time: Date | string | null;
  adjusted_end_time: Date | string | null;
  caregiver_signature_present: boolean | null;
  client_signature_present: boolean | null;
  incomplete_signature_reason: string | null;
  status: string;
  approver_id: string | null;
  approved_at: Date | string | null;
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.toISOString();
}

function rowToMaintenance(row: VisitMaintenanceRow): VisitMaintenance {
  return {
    id: row.id,
    visitId: row.visit_id,
    agencyId: row.agency_id ?? undefined,
    requesterId: row.requester_id,
    reason: row.reason,
    reasonCategoryCode:
      (row.reason_category_code as VisitMaintenance['reasonCategoryCode']) ?? undefined,
    correctionCode:
      (row.correction_code as VisitMaintenance['correctionCode']) ?? undefined,
    originatorRole:
      (row.originator_role as VisitMaintenance['originatorRole']) ?? undefined,
    originalStartTime: toIso(row.original_start_time),
    originalEndTime: toIso(row.original_end_time),
    adjustedStartTime: toIso(row.adjusted_start_time),
    adjustedEndTime: toIso(row.adjusted_end_time),
    caregiverSignaturePresent: row.caregiver_signature_present ?? undefined,
    clientSignaturePresent: row.client_signature_present ?? undefined,
    incompleteSignatureReason: row.incomplete_signature_reason ?? undefined,
    status: row.status as VisitMaintenance['status'],
    approverId: row.approver_id ?? undefined,
    approvedAt: toIso(row.approved_at),
  };
}

export class VisitMaintenanceRepository {
  constructor(private readonly db: Knex) {}

  async requestUnlock(maintenance: VisitMaintenance): Promise<VisitMaintenance> {
    const insertRow: Partial<VisitMaintenanceRow> = {
      id: maintenance.id ?? randomUUID(),
      visit_id: maintenance.visitId,
      agency_id: maintenance.agencyId ?? null,
      requester_id: maintenance.requesterId,
      reason: maintenance.reason,
      reason_category_code: maintenance.reasonCategoryCode ?? null,
      correction_code: maintenance.correctionCode ?? null,
      originator_role: maintenance.originatorRole ?? null,
      original_start_time: maintenance.originalStartTime ?? null,
      original_end_time: maintenance.originalEndTime ?? null,
      adjusted_start_time: maintenance.adjustedStartTime ?? null,
      adjusted_end_time: maintenance.adjustedEndTime ?? null,
      caregiver_signature_present:
        maintenance.caregiverSignaturePresent ?? null,
      client_signature_present: maintenance.clientSignaturePresent ?? null,
      incomplete_signature_reason: maintenance.incompleteSignatureReason ?? null,
      status: maintenance.status ?? 'pending',
    };

    const [inserted] = (await this.db('visit_maintenance')
      .insert(insertRow)
      .returning('*')) as VisitMaintenanceRow[];

    return rowToMaintenance(inserted);
  }

  async approveUnlock(
    id: string,
    args: {
      adjustedStartTime?: string;
      adjustedEndTime?: string;
      approverId: string;
    },
  ): Promise<VisitMaintenance | null> {
    const update: Partial<VisitMaintenanceRow> = {
      status: 'approved',
      approver_id: args.approverId,
      approved_at: new Date().toISOString(),
    };
    if (args.adjustedStartTime) update.adjusted_start_time = args.adjustedStartTime;
    if (args.adjustedEndTime) update.adjusted_end_time = args.adjustedEndTime;

    const [updated] = (await this.db('visit_maintenance')
      .where({ id })
      .update(update)
      .returning('*')) as VisitMaintenanceRow[];

    return updated ? rowToMaintenance(updated) : null;
  }

  async rejectUnlock(
    id: string,
    args: { approverId: string; reason: string },
  ): Promise<VisitMaintenance | null> {
    // Append the rejection rationale to the existing reason in a single
    // parameterized expression. `args.reason` is bound, never interpolated,
    // so SQL injection is impossible. `COALESCE` handles the (unlikely)
    // case where the original reason was NULL.
    const [updated] = (await this.db('visit_maintenance')
      .where({ id })
      .update({
        status: 'rejected',
        approver_id: args.approverId,
        approved_at: new Date().toISOString(),
        reason: this.db.raw(
          "COALESCE(reason, '') || E'\\nREJECTED: ' || ?",
          [args.reason],
        ) as unknown as string,
      })
      .returning('*')) as VisitMaintenanceRow[];

    return updated ? rowToMaintenance(updated) : null;
  }

  async findById(id: string): Promise<VisitMaintenance | undefined> {
    const row = (await this.db('visit_maintenance').where({ id }).first()) as
      | VisitMaintenanceRow
      | undefined;
    return row ? rowToMaintenance(row) : undefined;
  }

  /**
   * Coordinator review queue — pending corrections for an agency, oldest
   * first so the queue drains in the order it was filed.
   */
  async listPendingForAgency(agencyId: string, limit = 100): Promise<VisitMaintenance[]> {
    const rows = (await this.db('visit_maintenance')
      .where({ agency_id: agencyId, status: 'pending' })
      .orderBy('created_at', 'asc')
      .limit(limit)) as VisitMaintenanceRow[];
    return rows.map(rowToMaintenance);
  }

  async listForVisit(visitId: string): Promise<VisitMaintenance[]> {
    const rows = (await this.db('visit_maintenance')
      .where({ visit_id: visitId })
      .orderBy('created_at', 'desc')) as VisitMaintenanceRow[];
    return rows.map(rowToMaintenance);
  }

  /**
   * Full per-agency VMUR history — every status. Optional filters allow the
   * tracking page UI to narrow by status, originator role, or reason code.
   * Defaults: most-recent first, capped at 250 rows so a runaway agency
   * doesn't drag the response.
   */
  async listForAgency(
    agencyId: string,
    opts: {
      status?: 'pending' | 'approved' | 'rejected';
      originatorRole?: 'caregiver' | 'coordinator' | 'admin';
      reasonCategoryCode?: string;
      limit?: number;
    } = {},
  ): Promise<VisitMaintenance[]> {
    const query = this.db('visit_maintenance').where({ agency_id: agencyId });
    if (opts.status) query.where({ status: opts.status });
    if (opts.originatorRole) query.where({ originator_role: opts.originatorRole });
    if (opts.reasonCategoryCode) query.where({ reason_category_code: opts.reasonCategoryCode });

    const rows = (await query
      .orderBy('created_at', 'desc')
      .limit(opts.limit ?? 250)) as VisitMaintenanceRow[];
    return rows.map(rowToMaintenance);
  }
}
