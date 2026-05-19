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
export declare class AgencyRepository {
    private readonly db;
    constructor(db: Knex);
    createAgency(agency: Agency): Promise<Agency>;
    findById(id: string): Promise<Agency | null>;
    /**
     * Update an agency's mutable fields (today: just `name`). Returns the
     * updated row, or null if the agency doesn't exist. Used by the admin
     * AgencySetupPage save action — previously a stub that didn't persist.
     */
    findAll(): Promise<Agency[]>;
    findTheme(id: string): Promise<AgencyTheme | null>;
    updateName(id: string, name: string): Promise<Agency | null>;
    updateBilling(id: string, data: {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionStatus?: string;
        subscriptionTier?: string;
    }): Promise<void>;
    findByStripeCustomer(stripeCustomerId: string): Promise<Agency | null>;
    getBillingStatus(id: string): Promise<{
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        subscriptionStatus: string | null;
        subscriptionTier: string | null;
    } | null>;
    private mapRowToAgency;
}
//# sourceMappingURL=agency-repository.d.ts.map