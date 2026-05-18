import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Authorization {
  id: string;
  clientId: string;
  payerId: string;
  serviceCode: string;
  unitsAuthorized: number;
  startDate: string;
  endDate: string;
}

export function AuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [unitsAuthorized, setUnitsAuthorized] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuthorizations = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<Authorization[]>('/api/authorizations')
      .then(data => setAuthorizations(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load authorizations'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAuthorizations();
  }, [loadAuthorizations]);

  const focusAddAuthorization = () => {
    document.getElementById('clientId')?.focus();
  };

  const fillSampleData = () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const endStr = end.toISOString().slice(0, 10);
    const firstClientId = authorizations[0]?.clientId ?? 'client-sample-1';
    setClientId(firstClientId);
    setPayerId('PA-MA-12');
    setServiceCode('W1793');
    setUnitsAuthorized(120);
    setStartDate(todayStr);
    setEndDate(endStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const newAuth = await postJson<Authorization>('/api/authorizations', { 
        clientId, 
        payerId, 
        serviceCode, 
        unitsAuthorized: Number(unitsAuthorized),
        startDate,
        endDate
      });
      setAuthorizations(prev => [...prev, newAuth]);
      setClientId('');
      setPayerId('');
      setServiceCode('');
      setUnitsAuthorized('');
      setStartDate('');
      setEndDate('');
      setMessage('Authorization added successfully');
    } catch (err) {
      setMessage('Failed to add authorization');
    }
  };

  return (
    <div>
      <h2>PA Authorizations</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Manage service authorizations and unit tracking.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Add Authorization</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  color: 'var(--color-accent)',
                  border: '1px dashed var(--color-accent)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                Dev · Fill with sample data
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label htmlFor="clientId">Client ID</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <input id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="payerId">Payer ID</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <input id="payerId" value={payerId} onChange={e => setPayerId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="serviceCode">Service Code</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="serviceCode" value={serviceCode} onChange={e => setServiceCode(e.target.value)} required />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="units">Units</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="units" type="number" min="1" value={unitsAuthorized} onChange={e => setUnitsAuthorized(Number(e.target.value))} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="startDate">Start Date</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="endDate">End Date</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>

            <button type="submit">Save Authorization</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Active Authorizations</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadAuthorizations} />
          ) : authorizations.length === 0 ? (
            <EmptyState
              title="No authorizations yet"
              body="Add a PA authorization to track service units and effective dates."
              cta={{ label: 'Add an authorization', onClick: focusAddAuthorization }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {authorizations.map(a => {
                const isExpanded = expandedId === a.id;
                return (
                  <li
                    key={a.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: isExpanded ? '#f8fafc' : 'white'
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit'
                      }}
                    >
                      <div>
                        <strong>{a.serviceCode}</strong> - {a.unitsAuthorized} Units
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{a.startDate} to {a.endDate}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px' }}>
                          Client: {a.clientId.slice(0, 6)}...
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem', minWidth: '1ch', textAlign: 'center' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 1rem 1rem',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: '0.85rem',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.35rem 1rem',
                          color: '#475569'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>Authorization ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.id}</div>
                        <div style={{ fontWeight: 600 }}>Client ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.clientId}</div>
                        <div style={{ fontWeight: 600 }}>Payer ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.payerId}</div>
                        <div style={{ fontWeight: 600 }}>Service code</div>
                        <div>{a.serviceCode}</div>
                        <div style={{ fontWeight: 600 }}>Units authorized</div>
                        <div>{a.unitsAuthorized}</div>
                        <div style={{ fontWeight: 600 }}>Effective</div>
                        <div>{a.startDate} → {a.endDate}</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}