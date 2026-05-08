import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface Assignment {
  id: string;
  clientId: string;
  caregiverId: string;
  visitDate?: string;
}

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getJson<Assignment[]>('/api/assignments')
      .then(data => setAssignments(data || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const newAssign = await postJson<Assignment>('/api/assignments', { clientId, caregiverId, visitDate });
      setAssignments(prev => [...prev, newAssign]);
      setClientId('');
      setCaregiverId('');
      setVisitDate('');
      setMessage('Assignment created successfully');
    } catch (err) {
      setMessage('Failed to create assignment');
    }
  };

  return (
    <div>
      <h2>Caregiver Assignments</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Schedule and assign caregivers to client visits.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>New Assignment</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="clientId">Client ID</label>
              <input id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="caregiverId">Caregiver ID</label>
              <input id="caregiverId" value={caregiverId} onChange={e => setCaregiverId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="visitDate">Visit Date</label>
              <input id="visitDate" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
            
            <button type="submit">Create Assignment</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Upcoming Assignments</h3>
          {assignments.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
              No assignments found.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assignments.map(a => (
                <li key={a.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Caregiver: {a.caregiverId.slice(0,6)}...</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Client: {a.clientId.slice(0,6)}...</div>
                  </div>
                  {a.visitDate && <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', color: '#047857', borderRadius: '4px' }}>Date: {a.visitDate}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}