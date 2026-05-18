/**
 * LearningHubScreen — caregiver-facing list of assigned training courses.
 *
 * Capacitor + React (not React Native). Uses standard HTML/CSS — adapt class
 * names to your existing design system (Tailwind, SCSS modules, plain CSS,
 * whatever the app uses).
 *
 * Integration:
 *   1. Add a route in your React Router config:
 *        { path: '/learning', element: <LearningHubScreen /> }
 *   2. Add a tab/nav entry pointing at /learning
 *   3. Ensure useAuth() exposes the current user's caregiverId — adjust the
 *      import + hook name to match your app
 */

import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { fetchCaregiverProgress } from './api.js'
import type {
  CaregiverLearningProgress,
  EnrollmentStatus,
} from './types.js'

// Adjust this import to match your app's auth hook.
// Expected: useCurrentCaregiver() returns { caregiverId, firstName, lastName }
import { useCurrentCaregiver } from '../../hooks/useCurrentCaregiver.js' // <-- INTEGRATION POINT

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
}

const STATUS_THEME: Record<EnrollmentStatus, { bg: string; fg: string; border: string }> = {
  not_started: { bg: '#F1EFE8', fg: '#5F5E5A', border: '#D3D1C7' },
  in_progress: { bg: '#E6F1FB', fg: '#0C447C', border: '#B5D4F4' },
  completed:   { bg: '#E1F5EE', fg: '#085041', border: '#9FE1CB' },
  overdue:     { bg: '#FAEEDA', fg: '#633806', border: '#FAC775' },
  expired:     { bg: '#FCEBEB', fg: '#791F1F', border: '#F7C1C1' },
}

export function LearningHubScreen(): ReactElement {
  const caregiver = useCurrentCaregiver()
  const [progress, setProgress] = useState<CaregiverLearningProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!caregiver?.caregiverId) return
    let cancelled = false
    setLoading(true)
    fetchCaregiverProgress(caregiver.caregiverId)
      .then((result) => { if (!cancelled) setProgress(result) })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load training')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [caregiver?.caregiverId])

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Your training</h1>
        {progress && (
          <span style={progress.isCompliant ? compliantPillStyle : notCompliantPillStyle}>
            {progress.isCompliant ? 'Compliant' : 'Action needed'}
          </span>
        )}
      </header>

      {loading && <p style={mutedStyle}>Loading your training…</p>}

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not load your training.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {progress && progress.enrollments.length === 0 && (
        <div style={emptyStateStyle}>
          <p style={{ margin: 0, fontWeight: 500 }}>No courses assigned yet.</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            Your coordinator will assign required training during onboarding.
          </p>
        </div>
      )}

      {progress && progress.enrollments.length > 0 && (
        <ul style={listStyle}>
          {progress.enrollments.map(({ enrollment, course }) => {
            const theme = STATUS_THEME[enrollment.status]
            return (
              <li key={enrollment.id}>
                <Link to={`/learning/${enrollment.id}`} style={cardLinkStyle}>
                  <article style={cardStyle}>
                    <div style={cardHeadStyle}>
                      <h2 style={cardTitleStyle}>{course.title}</h2>
                      <span style={{ ...statusChipStyle, color: theme.fg, backgroundColor: theme.bg, borderColor: theme.border }}>
                        {STATUS_LABEL[enrollment.status]}
                      </span>
                    </div>
                    <p style={cardMetaStyle}>
                      {course.required ? 'Required · ' : ''}
                      {course.durationMinutes > 0 && `${course.durationMinutes} min · `}
                      {enrollment.dueAt && `Due ${formatDate(enrollment.dueAt)}`}
                      {!enrollment.dueAt && enrollment.expiresAt && `Expires ${formatDate(enrollment.expiresAt)}`}
                    </p>
                  </article>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------- Styles ----------
// Plain inline CSS to keep this self-contained. Swap for your app's
// design tokens (Tailwind classes, CSS modules) on integration.

const pageStyle: React.CSSProperties = {
  padding: '1.25rem',
  paddingBottom: '5rem', // room for bottom nav
  maxWidth: '720px',
  margin: '0 auto',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.25rem',
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 600,
  margin: 0,
  color: '#0b1220',
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

const emptyStateStyle: React.CSSProperties = {
  padding: '1.25rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px dashed #cbd5e1',
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const cardLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
  display: 'block',
}

const cardStyle: React.CSSProperties = {
  padding: '1rem 1.1rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
}

const cardHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginBottom: '0.5rem',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 500,
  color: '#0b1220',
}

const cardMetaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: '#64748b',
}

const statusChipStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.2rem 0.55rem',
  borderRadius: '999px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
}

const compliantPillStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.3rem 0.75rem',
  borderRadius: '999px',
  backgroundColor: '#E1F5EE',
  color: '#085041',
  fontWeight: 500,
}

const notCompliantPillStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.3rem 0.75rem',
  borderRadius: '999px',
  backgroundColor: '#FCEBEB',
  color: '#791F1F',
  fontWeight: 500,
}
