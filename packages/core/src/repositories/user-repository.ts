import type { Knex } from 'knex';
import type { User, NewUser } from '../domain/user.js';

export class UserRepository {
  constructor(private readonly db: Knex) {}

  async findByEmail(email: string): Promise<User | undefined> {
    // Join agencies so the login gate (agency review status) and account
    // suspension are available without a second query. The columns are R21+;
    // older snapshots simply return undefined for them, which the caller treats
    // as "not gated".
    const row = await this.db('users as u')
      .leftJoin('agencies as a', 'a.id', 'u.agency_id')
      .where('u.email', email.toLowerCase())
      .first('u.*', 'a.review_status as agency_review_status');
    if (!row) return undefined;
    return {
      id: row.id,
      agencyId: row.agency_id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      caregiverId: row.caregiver_id ?? undefined,
      suspendedAt: row.suspended_at
        ? (row.suspended_at instanceof Date ? row.suspended_at.toISOString() : String(row.suspended_at))
        : null,
      agencyReviewStatus: row.agency_review_status ?? undefined,
      totpEnabled: row.totp_enabled ?? false,
    };
  }

  async findById(id: string): Promise<User | undefined> {
    const row = await this.db('users').where({ id }).first();
    if (!row) return undefined;
    return {
      id: row.id,
      agencyId: row.agency_id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      caregiverId: row.caregiver_id ?? undefined
    };
  }

  async countAll(): Promise<number> {
    const [{ count }] = await this.db('users').count('id as count');
    return Number(count);
  }

  /**
   * Records that a user affirmatively accepted the Terms of Service at signup.
   * Idempotent-safe: callers invoke this once inside the signup transaction.
   */
  async recordTermsAcceptance(userId: string, version: string): Promise<void> {
    await this.db('users')
      .where({ id: userId })
      .update({ terms_accepted_at: this.db.fn.now(), terms_version: version });
  }

  async create(user: NewUser): Promise<User> {
    const [row] = await this.db('users')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: user.agencyId,
        email: user.email.toLowerCase(),
        password_hash: user.passwordHash,
        role: user.role,
        caregiver_id: user.caregiverId ?? null
      })
      .returning('*');
    return {
      id: row.id,
      agencyId: row.agency_id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      caregiverId: row.caregiver_id ?? undefined
    };
  }
}
