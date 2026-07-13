import type { Knex } from 'knex';
import type { VisitTaskCompletion, VisitTaskCompletionInput, VisitTaskPlanItem } from '../domain/visit-task-completion.js';
export declare function normalizeVisitTaskPlan(value: unknown): VisitTaskPlanItem[];
export declare class VisitTaskCompletionRepository {
    private readonly db;
    constructor(db: Knex);
    getForVisit(visitId: string, agencyId: string): Promise<{
        plan: VisitTaskPlanItem[];
        completions: VisitTaskCompletion[];
    }>;
    upsertBatch(input: {
        agencyId: string;
        visitId: string;
        caregiverId: string;
        completions: VisitTaskCompletionInput[];
    }): Promise<VisitTaskCompletion[]>;
    private mapRow;
}
//# sourceMappingURL=visit-task-completion-repository.d.ts.map