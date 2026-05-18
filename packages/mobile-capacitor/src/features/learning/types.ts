/**
 * Mirror of the Learning Hub types from @rayhealth/core. Inlined here so the
 * mobile-capacitor package doesn't need a workspace dependency on the core
 * package (which would force a heavier Vite/Capacitor build setup).
 *
 * Keep these in sync with packages/core/src/domain/learning.ts. If the source
 * shape changes, regenerate from there.
 */

export type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification'

export type EnrollmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'expired'

export interface LearningCourse {
  id: string
  agencyId: string | null
  code: string
  title: string
  description: string
  cadence: CourseCadence
  expiresAfterDays: number | null
  required: boolean
  durationMinutes: number
}

export interface CourseEnrollment {
  id: string
  caregiverId: string
  courseId: string
  assignedAt: string
  dueAt: string | null
  lastCompletedAt: string | null
  expiresAt: string | null
  status: EnrollmentStatus
}

export interface CaregiverLearningProgress {
  caregiverId: string
  enrollments: Array<{
    enrollment: CourseEnrollment
    course: LearningCourse
  }>
  isCompliant: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
