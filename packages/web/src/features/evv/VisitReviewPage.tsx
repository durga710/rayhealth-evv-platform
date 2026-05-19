import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged' | 'corrected';
}

interface StaffMember { id: string; email: string; role: string; }

type Banner = { kind: 'success' | 'error'; text: string } | null;

const statusBadgeClass = (status: EvvVisit['status']): string => {
  const map: Record<EvvVisit['status'], string> = {
    pending: 'badge badge-warning',
    verified: 'badge badge-success',
    flagged: 'badge badge-danger',
    corrected: 'badge badge-info',
  };
  return map[status] ?? 'badge badge-neutral';
};

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const caregiverLabel = (id: string) => {
    const s = staff.find(x => x.id === id);
    return s ? s.email : `${id.slice(0, 8)}…`;
  };

  const fetchVisits = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getJson<EvvVisit[]>('/api/evv/visits'),
      getJson<StaffMember[]>('/api/staff'),
    ])
      .then(([visitData, staffData]) => {
        setVisits(visitData || []);
        setStaff(staffData || []);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load visits'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleRequestCorrection = async (id: string) => {
    setBanner(null);
    try {
      await postJson('/api/maintenance/request-unlock', {
        visitId: id,
        reason: 'Coordinator requested EVV correction review from Visit Review',
      });
      setBanner({ kind: 'success', text: 'Correction request submitted successfully.' });
      fetchVisits();
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to submit correction request.' });
    }
  };

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Visit Review</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Review electronically verified visits and route corrections through visit maintenance.
          </p>
        </div>
      </header>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {banner.text}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} columns={5} />
      ) : loadError ? (
        <ErrorRetry message={loadError} onRetry={fetchVisits} />
      ) : visits.length === 0 ? (
        <EmptyState
          title="No visits yet"
          body="Verified visits will appear here once caregivers complete a clock-in/clock-out cycle."
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Caregiver</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr key={visit.id}>
                <td>{caregiverLabel(visit.caregiverId)}</td>
                <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8125rem' }}>{new Date(visit.clockInTime).toLocaleString()}</td>
                <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8125rem' }}>
                  {visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : <em style={{ color: '#94A3B8' }}>In progress</em>}
                </td>
                <td>
                  <span className={statusBadgeClass(visit.status)} style={{ textTransform: 'capitalize' }}>{visit.status}</span>
                </td>
                <td>
                  {(visit.status === 'pending' || visit.status === 'flagged') && (
                    <button
                      onClick={() => handleRequestCorrection(visit.id)}
                      className="btn-ghost btn-sm"
                    >
                      Request Correction
                    </button>
                  )}
                  {visit.status === 'verified' && (
                    <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>Closed</span>
                  )}
                  {visit.status === 'corrected' && (
                    <span style={{ fontSize: '0.8125rem', color: '#4F46E5' }}>Corrected</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
