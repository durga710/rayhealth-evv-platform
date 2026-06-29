import type { Knex } from 'knex';
import type { AssignmentComplianceCheck, CaregiverLearningProgress, CourseAnalyticsEnvelope, CourseCaregiverEnvelope, CourseCompletion, CourseEnrollment, LearningAgencyRollup, LearningCertificate, LearningCourse, LearningInsightsEnvelope, NewCourseCompletion, NewCourseEnrollment, NewLearningCourse } from '../domain/learning.js';
export declare class LearningRepository {
    private readonly db;
    constructor(db: Knex);
    listCourses(agencyId: string): Promise<LearningCourse[]>;
    findCourseById(id: string): Promise<LearningCourse | undefined>;
    findCourseByCode(agencyId: string | null, code: string): Promise<LearningCourse | undefined>;
    createCourse(data: NewLearningCourse): Promise<LearningCourse>;
    /**
     * Updates an agency-owned course. Global courses (agency_id NULL) are not
     * editable by agencies, so the WHERE clause scopes to the agency's own rows;
     * an attempt to edit a global or other-agency course matches nothing and
     * returns undefined.
     */
    updateCourse(id: string, agencyId: string, data: Partial<NewLearningCourse>): Promise<LearningCourse | undefined>;
    /**
     * Deletes an agency-owned course. Scoped to the agency's own rows so a global
     * or other-agency course cannot be removed. Returns true if a row was deleted.
     * Enrollments/completions cascade-delete via FK ON DELETE CASCADE.
     */
    deleteCourse(id: string, agencyId: string): Promise<boolean>;
    /** Idempotent upsert by (agency_id, code). Used by the catalog seed script. */
    upsertCourseByCode(data: NewLearningCourse): Promise<LearningCourse>;
    listEnrollmentsForCaregiver(caregiverId: string): Promise<CourseEnrollment[]>;
    findEnrollment(caregiverId: string, courseId: string): Promise<CourseEnrollment | undefined>;
    markInProgress(enrollmentId: string): Promise<void>;
    enroll(data: NewCourseEnrollment): Promise<CourseEnrollment>;
    recordCompletion(data: NewCourseCompletion): Promise<CourseCompletion>;
    getAgencyRollup(agencyId: string, now?: Date): Promise<LearningAgencyRollup>;
    getCaregiverProgress(caregiverId: string, now?: Date): Promise<CaregiverLearningProgress>;
    getCourseAnalytics(agencyId: string, now?: Date): Promise<CourseAnalyticsEnvelope>;
    getCourseCaregivers(courseId: string, agencyId: string, now?: Date): Promise<CourseCaregiverEnvelope | undefined>;
    /**
     * Assembles certificate-of-completion data for a caregiver's completed course.
     * Returns undefined if the caregiver has no completed enrollment for the
     * course (so the route can 404 rather than mint a certificate for incomplete
     * training). The verification code is derived from the enrollment id.
     */
    getCertificate(courseId: string, caregiverId: string): Promise<LearningCertificate | undefined>;
    getAssignmentBlockers(caregiverId: string, now?: Date): Promise<AssignmentComplianceCheck>;
    getActionableInsights(agencyId: string, now?: Date): Promise<LearningInsightsEnvelope>;
    private fetchInsightRows;
    private toInsightCaregiver;
    private formatRelative;
    private deriveStatus;
    private mapCourse;
    private mapEnrollment;
    private mapCompletion;
    private toIsoString;
}
//# sourceMappingURL=learning-repository.d.ts.map