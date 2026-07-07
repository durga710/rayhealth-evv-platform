import type { Knex } from 'knex';
import type { EvvException } from '../domain/evv-exception.js';
export declare class EvvExceptionRepository {
    private readonly db;
    constructor(db: Knex);
    create(exception: Omit<EvvException, 'id'>): Promise<EvvException>;
    /**
     * Agency-scoped exception read for a single visit — used by the audit
     * packet route (`GET /admin/audit-packet/:visitId`). Joins
     * evv_exceptions -> evv_visits -> caregivers and filters on
     * caregivers.agency_id, the same authorization pattern as
     * ComplianceEngineRepository.acknowledgeException. This is the only
     * sanctioned scoped-by-visit read on this table; do not add another
     * unscoped one (see the NOTE above).
     */
    findExceptionsByVisitForAgency(visitId: string, agencyId: string): Promise<EvvException[]>;
    private mapRow;
}
//# sourceMappingURL=evv-exception-repository.d.ts.map