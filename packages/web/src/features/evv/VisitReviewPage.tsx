import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged';
}

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<EvvVisit[]>('/api/evv/visits')
      .then(setVisits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>EVV Visit Review</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Review and approve electronically verified visits.
      </p>

      {loading ? (
        <p>Loading visits...</p>
      ) : (
        <table>
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
                <td>{visit.caregiverId.slice(0, 8)}...</td>
                <td>{new Date(visit.clockInTime).toLocaleString()}</td>
                <td>{visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : 'N/A'}</td>
                <td>{visit.status}</td>
                <td><button>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
