/**
 * Ledger of ingested 835 remittance files, keyed by (agency, content sha256).
 *
 * postEra is intentionally append-plus-update and NOT idempotent, so the
 * sweep consults this ledger before posting: a file already ingested (same
 * content hash) is skipped, which makes re-downloading the same remote file
 * on every sweep safe. Rows are recorded only after a successful postEra so
 * a failed posting is retried on the next sweep.
 */

import type { Knex } from 'knex';

export interface RemittanceFileRecord {
  id: string;
  agencyId: string;
  fileName: string;
  sha256: string;
  transport: string;
  claimCount: number;
  matchedCount: number;
  totalPaidCents: number;
  traceNumber: string | null;
  ingestedAt: string;
}

export interface NewRemittanceFileRecord {
  agencyId: string;
  fileName: string;
  sha256: string;
  transport: string;
  claimCount: number;
  matchedCount: number;
  totalPaidCents: number;
  traceNumber: string | null;
}

interface Row {
  id: string;
  agency_id: string;
  file_name: string;
  sha256: string;
  transport: string;
  claim_count: number | string;
  matched_count: number | string;
  total_paid_cents: number | string;
  trace_number: string | null;
  ingested_at: Date | string;
}

function mapRow(row: Row): RemittanceFileRecord {
  return {
    id: row.id,
    agencyId: row.agency_id,
    fileName: row.file_name,
    sha256: row.sha256,
    transport: row.transport,
    claimCount: Number(row.claim_count ?? 0),
    matchedCount: Number(row.matched_count ?? 0),
    totalPaidCents: Number(row.total_paid_cents ?? 0),
    traceNumber: row.trace_number ?? null,
    ingestedAt: new Date(row.ingested_at).toISOString(),
  };
}

export class ClearinghouseRemittanceFileRepository {
  constructor(private readonly db: Knex) {}

  async hasIngested(agencyId: string, sha256: string): Promise<boolean> {
    const row = await this.db('clearinghouse_remittance_files')
      .where({ agency_id: agencyId, sha256 })
      .first('id');
    return Boolean(row);
  }

  async record(input: NewRemittanceFileRecord): Promise<void> {
    await this.db('clearinghouse_remittance_files')
      .insert({
        agency_id: input.agencyId,
        file_name: input.fileName,
        sha256: input.sha256,
        transport: input.transport,
        claim_count: input.claimCount,
        matched_count: input.matchedCount,
        total_paid_cents: input.totalPaidCents,
        trace_number: input.traceNumber,
      })
      .onConflict(['agency_id', 'sha256'])
      .ignore();
  }

  async list(agencyId: string, limit = 50): Promise<RemittanceFileRecord[]> {
    const rows = (await this.db('clearinghouse_remittance_files')
      .where({ agency_id: agencyId })
      .orderBy('ingested_at', 'desc')
      .limit(limit)) as Row[];
    return rows.map(mapRow);
  }
}
