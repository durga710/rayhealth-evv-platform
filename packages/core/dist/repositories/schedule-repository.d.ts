import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';
export declare class ScheduleRepository {
    private readonly db;
    constructor(db: Knex);
    createAssignment(assignment: AssignmentInput): Promise<any>;
}
//# sourceMappingURL=schedule-repository.d.ts.map