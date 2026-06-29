import { describe, expect, it } from 'vitest';
import { AgencyEvvConfigRepository } from '../repositories/agency-evv-config-repository.js';
/**
 * The repository talks to knex via a small surface: `where`, `first`, `insert`,
 * `onConflict`, `merge`, `fn.now`. We fake these in-memory so the resolver and
 * `findOrInitialize` paths can be exercised without a real DB.
 */
function makeFakeDb(initial) {
    let row = initial;
    const builder = {
        where: () => builder,
        first: async () => row,
        insert(_data) { return builder; },
        onConflict: () => builder,
        merge: async (data) => {
            if (row) {
                row = {
                    ...row,
                    aggregator: data.aggregator ?? row.aggregator,
                    state_code: data.state_code ?? row.state_code,
                    production_ready: data.production_ready ?? row.production_ready,
                };
            }
            return 1;
        },
    };
    const db = ((_table) => builder);
    db.fn = { now: () => 'NOW()' };
    return {
        db,
        setRow(next) { row = next; },
        getRow() { return row; },
    };
}
describe('AgencyEvvConfigRepository', () => {
    it('findOrInitialize returns state default when no row exists (PA → sandata)', async () => {
        const { db } = makeFakeDb(undefined);
        const repo = new AgencyEvvConfigRepository(db);
        const config = await repo.findOrInitialize('agency-1', 'PA');
        expect(config.aggregator).toBe('sandata');
        expect(config.stateCode).toBe('PA');
        expect(config.productionReady).toBe(false);
    });
    it('findOrInitialize returns state default for NJ (forced HHAeXchange)', async () => {
        const { db } = makeFakeDb(undefined);
        const repo = new AgencyEvvConfigRepository(db);
        const config = await repo.findOrInitialize('agency-1', 'NJ');
        expect(config.aggregator).toBe('hhaexchange');
        expect(config.stateCode).toBe('NJ');
    });
    it('findOrInitialize uppercases the state code', async () => {
        const { db } = makeFakeDb(undefined);
        const repo = new AgencyEvvConfigRepository(db);
        const config = await repo.findOrInitialize('agency-1', 'pa');
        expect(config.stateCode).toBe('PA');
    });
    it('findByAgency returns the stored row when present', async () => {
        const { db } = makeFakeDb({
            agency_id: 'agency-1',
            aggregator: 'hhaexchange',
            state_code: 'PA',
            production_ready: true,
        });
        const repo = new AgencyEvvConfigRepository(db);
        const config = await repo.findByAgency('agency-1');
        expect(config?.aggregator).toBe('hhaexchange');
        expect(config?.stateCode).toBe('PA');
        expect(config?.productionReady).toBe(true);
    });
    it('resolve respects state choice flag — NJ ignores agency preference', async () => {
        // Even if the agency persists 'sandata', NJ has aggregatorChoice=false so
        // the resolver must return the state default (hhaexchange).
        const { db } = makeFakeDb({
            agency_id: 'agency-1',
            aggregator: 'sandata',
            state_code: 'NJ',
            production_ready: false,
        });
        const repo = new AgencyEvvConfigRepository(db);
        const resolved = await repo.resolve('agency-1', 'NJ');
        expect(resolved).toBe('hhaexchange');
    });
    it('resolve uses agency preference for choice-allowed states (PA)', async () => {
        const { db } = makeFakeDb({
            agency_id: 'agency-1',
            aggregator: 'hhaexchange',
            state_code: 'PA',
            production_ready: false,
        });
        const repo = new AgencyEvvConfigRepository(db);
        const resolved = await repo.resolve('agency-1', 'PA');
        expect(resolved).toBe('hhaexchange');
    });
    it('resolve falls back to state default when no row exists', async () => {
        const { db } = makeFakeDb(undefined);
        const repo = new AgencyEvvConfigRepository(db);
        const resolved = await repo.resolve('agency-1', 'PA');
        expect(resolved).toBe('sandata');
    });
});
//# sourceMappingURL=agency-evv-config-repository.test.js.map