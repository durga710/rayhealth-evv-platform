import type { Knex } from 'knex';
import type { Agency, AgencyTheme } from '../domain/agency.js';

export interface AgencyRow {
  id: string;
  name: string;
  state: string;
  operating_tracks: string;
  medicaid_provider_number?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export class AgencyRepository {
  constructor(private readonly db: Knex) {}

  async createAgency(agency: Agency): Promise<Agency> {
    const row: AgencyRow = {
      id: agency.id ?? crypto.randomUUID(),
      name: agency.name,
      state: agency.state,
      operating_tracks: JSON.stringify(agency.operatingTracks),
      medicaid_provider_number: agency.medicaidProviderNumber
    };

    const [inserted] = await this.db<AgencyRow>('agencies').insert(row).returning('*');
    return this.mapRowToAgency(inserted);
  }

  async findById(id: string): Promise<Agency | null> {
    const row = await this.db<AgencyRow>('agencies').where({ id }).first();
    return row ? this.mapRowToAgency(row) : null;
  }

  /**
   * Update an agency's mutable fields (today: just `name`). Returns the
   * updated row, or null if the agency doesn't exist. Used by the admin
   * AgencySetupPage save action — previously a stub that didn't persist.
   */
  async findAll(): Promise<Agency[]> {
    const rows = await this.db<AgencyRow>('agencies').select('*').orderBy('name');
    return rows.map((r) => this.mapRowToAgency(r));
  }

  async findTheme(id: string): Promise<AgencyTheme | null> {
    const row = await this.db('agencies').select('features').where({ id }).first();
    if (!row) return null;
    const features: Record<string, unknown> = typeof row.features === 'string' ? JSON.parse(row.features) : row.features ?? {};
    return (features.theme as AgencyTheme) ?? null;
  }

  async updateName(id: string, name: string): Promise<Agency | null> {
    const trimmed = name.trim();
    if (!trimmed) return this.findById(id);
    const [row] = await this.db<AgencyRow>('agencies')
      .where({ id })
      .update({ name: trimmed, updated_at: this.db.fn.now() as unknown as Date })
      .returning('*');
    return row ? this.mapRowToAgency(row) : null;
  }

  async updateBilling(
    id: string,
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionTier?: string;
    }
  ): Promise<void> {
    const patch: Partial<AgencyRow> = {};
    if (data.stripeCustomerId !== undefined) patch.stripe_customer_id = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) patch.stripe_subscription_id = data.stripeSubscriptionId;
    if (data.subscriptionStatus !== undefined) patch.subscription_status = data.subscriptionStatus;
    if (data.subscriptionTier !== undefined) patch.subscription_tier = data.subscriptionTier;
    if (Object.keys(patch).length === 0) return;
    await this.db<AgencyRow>('agencies').where({ id }).update(patch);
  }

  async findByStripeCustomer(stripeCustomerId: string): Promise<Agency | null> {
    const row = await this.db<AgencyRow>('agencies')
      .where({ stripe_customer_id: stripeCustomerId })
      .first();
    return row ? this.mapRowToAgency(row) : null;
  }

  async getBillingStatus(id: string): Promise<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    subscriptionTier: string | null;
  } | null> {
    const row = await this.db<AgencyRow>('agencies')
      .where({ id })
      .select('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_tier')
      .first();
    if (!row) return null;
    return {
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      subscriptionStatus: row.subscription_status ?? null,
      subscriptionTier: row.subscription_tier ?? null,
    };
  }

  private mapRowToAgency(row: AgencyRow): Agency {
    return {
      id: row.id,
      name: row.name,
      state: row.state as 'PA',
      operatingTracks: typeof row.operating_tracks === 'string' ? JSON.parse(row.operating_tracks) : row.operating_tracks,
      medicaidProviderNumber: row.medicaid_provider_number
    };
  }
}
