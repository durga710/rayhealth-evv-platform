import type { Knex } from 'knex';
import type { EvvVisit } from '../domain/evv.js';
export declare class EvvRepository {
    private readonly db;
    constructor(db: Knex);
    createVisit(visit: EvvVisit): Promise<EvvVisit>;
    updateVisit(id: string, visit: Partial<EvvVisit>): Promise<EvvVisit | null>;
    private mapRowToVisit;
}
//# sourceMappingURL=evv-repository.d.ts.map