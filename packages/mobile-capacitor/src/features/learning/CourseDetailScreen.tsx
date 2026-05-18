/**
 * CourseDetailScreen — single course detail for the caregiver.
 *
 * Shows course description, current enrollment status, and a Mark complete /
 * Recertify button that records a completion event via POST /api/learning/complete.
 *
 * Integration:
 *   - Route: { path: '/learning/:enrollmentId', element: <CourseDetailScreen /> }
 *   - Expects useCurrentCaregiver() to return the logged-in caregiver
 *   - On successful completion, navigates back to /learning
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchCaregiverProgress, recordCompletion } from './api.js'
import type {
  CaregiverLearningProgress,
  CourseEnrollment,
  EnrollmentStatus,
  LearningCourse,
} from './types.js'

import { useCurrentCaregiver } from '../../hooks/useCurrentCaregiver.js' // <-- INTEGRATION POINT

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
}

const COMPLETE_BUTTON_LABEL: Record<EnrollmentStatus, string> = {
  not_started: 'Mark complete',
  in_progress: 'Mark complete',
  completed: 'Recertify',
  overdue: 'Mark complete',
  expired: 'Recertify',
}

export function CourseDetailScreen(): ReactElement {
  const { enrollmentId } = useParams<{ enrollmentId: string }>()
  const navigate = useNavigate()
  const caregiver = useCurrentCaregiver()

  const [progress, setProgress] = useState<CaregiverLearningProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!caregiver?.caregiverId) return
    let cancelled = false
    setLoading(true)
    fetchCaregiverProgress(caregiver.caregiverId)
      .then((result) => { if (!cancelled) setProgress(result) })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load course')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [caregiver?.caregiverId])

  const entry: { enrollment: CourseEnrollment; course: LearningCourse } | undefined = useMemo(() => {
    if (!progress) return undefined
    return progress.enrollments.find((e) => e.enrollment.id === enrollmentId)
  }, [progress, enrollmentId])

  async function handleComplete(): Promise<void> {
    if (!entry) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await recordCompletion({
        enrollmentId: entry.enrollment.id,
        caregiverId: entry.enrollment.caregiverId,
        courseId: entry.course.id,
        score: null,
        notes: 'Caregiver self-attested via mobile',
      })
      navigate('/learning')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Could not record completion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={pageStyle}>
      <nav style={navStyle}>
        <Link to="/learning" style={backLinkStyle}>← Your training</Link>
      </nav>

      {loading && <p style={mutedStyle}>Loading course…</p>}

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not load this course.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {!loading && progress && !entry && (
        <div style={errorBoxStyle}>
          <strong>Course not found.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            This enrollment may have been removed. Pull to refresh and check again.
          </p>
        </div>
      )}

      {entry && (
        <>
          <header style={headerStyle}>
            <h1 style={titleStyle}>{entry.course.title}</h1>
            <span style={statusPillStyle(entry.enrollment.status)}>
              {STATUS_LABEL[entry.enrollment.status]}
            </span>
          </header>

          <p style={descriptionStyle}>{entry.course.description}</p>

          <dl style={metaListStyle}>
            <MetaRow label="Cadence" value={cadenceLabel(entry.course.cadence)} />
            {entry.course.durationMinutes > 0 && (
              <MetaRow label="Estimated time" value={`${entry.course.durationMinutes} min`} />
            )}
            {entry.enrollment.dueAt && (
              <MetaRow label="Due" value={formatDate(entry.enrollment.dueAt)} />
            )}
            {entry.enrollment.lastCompletedAt && (
              <MetaRow label="Last completed" value={formatDate(entry.enrollment.lastCompletedAt)} />
            )}
            {entry.enrollment.expiresAt && (
              <MetaRow label="Expires" value={formatDate(entry.enrollment.expiresAt)} />
            )}
            <MetaRow label="Course code" value={entry.course.code} />
          </dl>

          {submitError && (
            <div role="alert" style={{ ...errorBoxStyle, margin: '1rem 0 0' }}>
              {submitError}
            </div>
          )}

          <button
            onClick={() => void handleComplete()}
            disabled={submitting}
            aria-busy={submitting}
            style={ctaButtonStyle}
          >
            {submitting ? 'Recording…' : COMPLETE_BUTTON_LABEL[entry.enrollment.status]}
          </button>

          <p style={attestationDisclosureStyle}>
            By tapping {COMPLETE_BUTTON_LABEL[entry.enrollment.status]}, you attest that you have
            completed this training. Your coordinator will see this completion in the agency
            audit log.
          </p>
        </>
      )}
    </main>
  )
}

function MetaRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div style={metaRowStyle}>
      <dt style={metaLabelStyle}>{label}</dt>
      <dd style={metaValueStyle}>{value}</dd>
    </div>
  )
}

function cadenceLabel(cadence: LearningCourse['cadence']): string {
  switch (cadence) {
    case 'one_time': return 'One-time'
    case 'annual': return 'Annual'
    case 'biennial': return 'Every 2 years'
    case 'certification': return 'External certification'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusPillStyle(status: EnrollmentStatus): React.CSSProperties {
  const theme: Record<EnrollmentStatus, { bg: string; fg: string }> = {
    not_started: { bg: '#F1EFE8', fg: '#5F5E5A' },
    in_progress: { bg: '#E6F1FB', fg: '#0C447C' },
    completed:   { bg: '#E1F5EE', fg: '#085041' },
    overdue:     { bg: '#FAEEDA', fg: '#633806' },
    expired:     { bg: '#FCEBEB', fg: '#791F1F' },
  }
  return {
    fontSize: '0.75rem',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backgroundColor: theme[status].bg,
    color: theme[status].fg,
  }
}

// ---------- Styles ----------

const pageStyle: React.CSSProperties = {
  padding: '1.25rem',
  paddingBottom: '5rem',
  maxWidth: '720px',
  margin: '0 auto',
}

const navStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
}

const backLinkStyle: React.CSSProperties = {
  color: '#185FA5',
  textDecoration: 'none',
  fontSize: '0.9rem',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginBottom: '0.85rem',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.4rem',
  fontWeight: 600,
  color: '#0b1220',
  flex: 1,
}

const descriptionStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '0.95rem',
  lineHeight: 1.55,
  color: '#334155',
}

const metaListStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.75rem 1rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  fontSize: '0.9rem',
}

const metaLabelStyle: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
}

const metaValueStyle: React.CSSProperties = {
  margin: 0,
  color: '#0b1220',
  fontWeight: 500,
}

const ctaButtonStyle: React.CSSProperties = {
  marginTop: '1.25rem',
  width: '100%',
  padding: '0.9rem 1rem',
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const attestationDisclosureStyle: React.CSSProperties = {
  margin: '0.85rem 0 0',
  fontSize: '0.78rem',
  color: '#64748b',
  textAlign: 'center',
  lineHeight: 1.4,
}

const mutedStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.95rem',
}

const errorBoxStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '8px',
  borderLeft: '4px solid #E24B4A',
}
