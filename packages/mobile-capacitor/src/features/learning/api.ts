/**
 * Learning API client for the Capacitor mobile app.
 *
 * Uses the existing JWT-based mobile auth (same pattern as evv-routes).
 * Token is read from Capacitor SecureStorage at call time so token rotations
 * are picked up automatically.
 *
 * Integration assumption: the app exports a `getAuthToken()` function from
 * `src/services/auth.ts` (or similar). If your app uses a different module,
 * change the import below — this is the one swap point.
 */

import type {
  ApiResponse,
  CaregiverLearningProgress,
  CourseEnrollment,
  LearningCourse,
} from './types.js'

// Adjust this import to match your app's auth-token accessor.
// Expected signature: () => Promise<string | null>
// If your app keeps the token in a Capacitor SecureStorage key called
// 'rayhealth_jwt', the default import below should work — replace if not.
import { getAuthToken } from '../../services/auth.js' // <-- INTEGRATION POINT

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://rayhealthevv.com'

class LearningApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'LearningApiError'
  }
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  if (!token) {
    throw new LearningApiError('Not authenticated', 401)
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const message = `Request to ${path} failed: ${response.status}`
    throw new LearningApiError(message, response.status)
  }
  const body = (await response.json()) as ApiResponse<T>
  if (!body.success || body.data === undefined) {
    throw new LearningApiError(body.error ?? 'API returned unsuccessful response', response.status)
  }
  return body.data
}

// ---------- Public API ----------

export async function fetchCaregiverProgress(
  caregiverId: string,
): Promise<CaregiverLearningProgress> {
  return authedFetch<CaregiverLearningProgress>(`/api/learning/caregivers/${caregiverId}`)
}

export async function fetchCourseCatalog(): Promise<LearningCourse[]> {
  return authedFetch<LearningCourse[]>('/api/learning/courses')
}

export interface CompletionInput {
  enrollmentId: string
  caregiverId: string
  courseId: string
  /** Optional ISO string; defaults to now on the server. */
  completedAt?: string
  /** 0–100 if course has a quiz; null otherwise. */
  score?: number | null
  /** Free-text notes shown to coordinators in the audit trail. */
  notes?: string | null
}

export async function recordCompletion(input: CompletionInput): Promise<CourseEnrollment> {
  return authedFetch<CourseEnrollment>('/api/learning/complete', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      completedAt: input.completedAt ?? new Date().toISOString(),
    }),
  })
}
