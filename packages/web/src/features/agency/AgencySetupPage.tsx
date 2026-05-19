import React, { useEffect, useState } from 'react';
import { getJson, putJson } from '../../lib/api-client.js';

interface Agency {
  id: string;
  name: string;
  state: string;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then(data => {
        setAgency(data);
        setName(data.name);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load agency'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSaving(true);
    try {
      const updated = await putJson<Agency>('/api/agencies/current', { name });
      setAgency(updated);
      setName(updated.name);
      setBanner({ kind: 'success', text: 'Agency details saved.' });
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to update agency.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <header className="page-header">
          <div className="page-header__title">
            <h1 style={{ margin: 0 }}>Agency Setup</h1>
            <p style={{ margin: 0, color: '#64748B' }}>Configure your Pennsylvania agency details.</p>
          </div>
        </header>
        <div style={{ padding: '2rem', color: '#94A3B8' }}>Loading agency details…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <header className="page-header">
          <div className="page-header__title">
            <h1 style={{ margin: 0 }}>Agency Setup</h1>
          </div>
        </header>
        <div role="alert" className="info-banner banner-error">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Agency Setup</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Configure your Pennsylvania agency details and operating tracks.
          </p>
        </div>
      </header>

      <div className="form-card" style={{ maxWidth: '560px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="agencyName" className="label">Agency Name</label>
            <input
              id="agencyName"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter agency name"
              required
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="agencyState" className="label">State</label>
            <input
              id="agencyState"
              value={agency?.state || 'PA'}
              disabled
              className="input-field"
            />
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
              State is locked to Pennsylvania. RayHealth EVV is purpose-built for PA DHS Personal Assistance Services.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim() || name === agency?.name}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        {banner && (
          <div
            role={banner.kind === 'error' ? 'alert' : 'status'}
            className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
            style={{ marginTop: '1rem' }}
          >
            {banner.text}
          </div>
        )}
      </div>
    </div>
  );
}
