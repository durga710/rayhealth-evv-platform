import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';

export class ScheduleRepository {
  constructor(private readonly db: Knex) {}

  async createAssignment(assignment: AssignmentInput): Promise<any> {
    const [inserted] = await this.db('assignments').insert({
      id: crypto.randomUUID(),
      caregiver_id: assignment.caregiverId,
      visit_template_id: assignment.visitTemplateId
    }).returning('*');

    return inserted;
  }
}
