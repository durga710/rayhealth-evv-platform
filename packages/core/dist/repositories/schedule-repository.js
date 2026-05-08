export class ScheduleRepository {
    constructor(db) {
        this.db = db;
    }
    async createTemplate(template) {
        const [inserted] = await this.db('visit_templates').insert({
            id: crypto.randomUUID(),
            client_id: template.clientId,
            name: template.name,
            tasks: JSON.stringify(template.tasks)
        }).returning('*');
        return {
            id: inserted.id,
            clientId: inserted.client_id,
            name: inserted.name,
            tasks: typeof inserted.tasks === 'string' ? JSON.parse(inserted.tasks) : inserted.tasks
        };
    }
    async getTemplates(agencyId) {
        const rows = await this.db('visit_templates')
            .join('clients', 'visit_templates.client_id', 'clients.id')
            .where('clients.agency_id', agencyId)
            .select('visit_templates.*');
        return rows.map(row => ({
            id: row.id,
            clientId: row.client_id,
            name: row.name,
            tasks: typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
        }));
    }
    async createAssignment(assignment) {
        const [inserted] = await this.db('assignments').insert({
            id: crypto.randomUUID(),
            caregiver_id: assignment.caregiverId,
            visit_template_id: assignment.visitTemplateId
        }).returning('*');
        return {
            id: inserted.id,
            caregiverId: inserted.caregiver_id,
            visitTemplateId: inserted.visit_template_id
        };
    }
    async getAssignments(agencyId) {
        const rows = await this.db('assignments')
            .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
            .join('clients', 'visit_templates.client_id', 'clients.id')
            .where('clients.agency_id', agencyId)
            .select('assignments.*', 'clients.id as client_id');
        return rows.map(row => ({
            id: row.id,
            clientId: row.client_id,
            caregiverId: row.caregiver_id,
            visitTemplateId: row.visit_template_id
        }));
    }
}
//# sourceMappingURL=schedule-repository.js.map