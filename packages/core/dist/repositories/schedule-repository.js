export class ScheduleRepository {
    constructor(db) {
        this.db = db;
    }
    async createAssignment(assignment) {
        const [inserted] = await this.db('assignments').insert({
            id: crypto.randomUUID(),
            caregiver_id: assignment.caregiverId,
            visit_template_id: assignment.visitTemplateId
        }).returning('*');
        return inserted;
    }
}
//# sourceMappingURL=schedule-repository.js.map