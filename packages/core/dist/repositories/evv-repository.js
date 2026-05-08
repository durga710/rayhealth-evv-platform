export class EvvRepository {
    constructor(db) {
        this.db = db;
    }
    async createVisit(visit) {
        const [inserted] = await this.db('evv_visits').insert({
            id: visit.id ?? crypto.randomUUID(),
            assignment_id: visit.assignmentId,
            caregiver_id: visit.caregiverId,
            clock_in_time: visit.clockInTime,
            clock_in_location: JSON.stringify(visit.clockInLocation),
            status: visit.status
        }).returning('*');
        return this.mapRowToVisit(inserted);
    }
    async updateVisit(id, visit) {
        const updateData = {};
        if (visit.clockOutTime)
            updateData.clock_out_time = visit.clockOutTime;
        if (visit.clockOutLocation)
            updateData.clock_out_location = JSON.stringify(visit.clockOutLocation);
        if (visit.status)
            updateData.status = visit.status;
        const [updated] = await this.db('evv_visits')
            .where({ id })
            .update(updateData)
            .returning('*');
        return updated ? this.mapRowToVisit(updated) : null;
    }
    async getAllVisits() {
        const rows = await this.db('evv_visits').select('*');
        return rows.map(row => this.mapRowToVisit(row));
    }
    mapRowToVisit(row) {
        return {
            id: row.id,
            assignmentId: row.assignment_id,
            caregiverId: row.caregiver_id,
            clockInTime: row.clock_in_time instanceof Date ? row.clock_in_time.toISOString() : row.clock_in_time,
            clockOutTime: row.clock_out_time instanceof Date ? row.clock_out_time.toISOString() : row.clock_out_time,
            clockInLocation: typeof row.clock_in_location === 'string' ? JSON.parse(row.clock_in_location) : row.clock_in_location,
            clockOutLocation: typeof row.clock_out_location === 'string' ? JSON.parse(row.clock_out_location) : row.clock_out_location,
            status: row.status
        };
    }
}
//# sourceMappingURL=evv-repository.js.map