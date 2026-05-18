import { useEffect, useState, type ReactElement } from 'react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';
import { useAuth } from '../../lib/AuthContext.js';

/**
 * Agency Settings — admin-only configuration surface. Currently houses the
 * AI Workflow Copilot add-on toggle. Future sections (notification policy,
 * brand customization, billing) hang off the same page.
 *
 * The page is reachable from any nav entry but the AI Copilot section
 * specifically renders a read-only "Owner-only" notice for non-admins,
 * matching the brand requirement that billing controls are private.
 */

type AiCopilotPlan = 'off' | 'starter' | 'pro';
type NotificationDigest = 'off' | 'daily' | 'weekly';

interface AiCopilotFlag {
  enabled: boolean;
  plan: AiCopilotPlan;
}

interface NotificationsFlag {
  coordinatorDigest: NotificationDigest;
  caregiverPush: boolean;
  caregiverEmail: boolean;
  familyEmail: boolean;
}

interface AgencyFeatures {
  aiCopilot: AiCopilotFlag;
  notifications: NotificationsFlag;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Plain fetch with PUT — postJson is hardcoded to POST. Sharing the CSRF logic
// inline keeps this file readable without adding a putJson to api-client.
async function putJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = readCsrfToken();
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let parsed: unknown = null;
    try { parsed = await response.json(); } catch { /* swallow */ }
    throw new HttpError(response.status, parsed, `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function readCsrfToken(): string | null {
  // Same source the rest of the app uses; duplicated to avoid coupling
  // this page to session-state internals.
  const meta = document.cookie.split(';').find((c) => c.trim().startsWith('rayhealth_csrf='));
  return meta ? decodeURIComponent(meta.split('=')[1] ?? '') : null;
}

export function AgencySettingsPage(): ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [features, setFeatures] = useState<AgencyFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<AgencyFeatures>>('/api/agencies/me/features');
        if (cancelled) return;
        if (response.success && response.data) {
          setFeatures(response.data);
        } else {
          setError(response.error ?? 'Failed to load features');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load features');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveFeatures = async (next: AgencyFeatures): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<AgencyFeatures>>('/api/agencies/me/features', next);
      if (response.success && response.data) {
        setFeatures(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change agency features.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCopilot = (): void => {
    if (!features) return;
    const next: AgencyFeatures = {
      ...features,
      aiCopilot: {
        ...features.aiCopilot,
        enabled: !features.aiCopilot.enabled,
        // When enabling for the first time, default to starter.
        plan: features.aiCopilot.enabled ? 'off' : (features.aiCopilot.plan === 'off' ? 'starter' : features.aiCopilot.plan),
      },
    };
    void saveFeatures(next);
  };

  const setPlan = (plan: AiCopilotPlan): void => {
    if (!features) return;
    void saveFeatures({
      ...features,
      aiCopilot: { ...features.aiCopilot, plan, enabled: plan !== 'off' },
    });
  };

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Agency settings</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
          Per-agency configuration. Add-on entitlements visible only to admins.
        </p>
      </header>

      {loading && <p>Loading settings…</p>}

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not save.</strong> {error}
        </div>
      )}

      {features && (
        <section style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
                AI Workflow Copilot
              </h3>
              <p style={sectionSubtitleStyle}>
                Per-role assistants (caregiver, coordinator, owner) backed by Google Gemini.
                Every action proposed by the copilot requires admin confirmation before executing.
              </p>
            </div>
            <span style={features.aiCopilot.enabled ? activeBadgeStyle : inactiveBadgeStyle}>
              {features.aiCopilot.enabled ? 'Active' : 'Off'}
            </span>
          </div>

          {!isAdmin && (
            <div style={readOnlyNoticeStyle}>
              <strong>Owner-only setting.</strong> Only an agency admin can enable or change this add-on.
            </div>
          )}

          {isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={toggleRowStyle}>
                <input
                  type="checkbox"
                  checked={features.aiCopilot.enabled}
                  onChange={toggleCopilot}
                  disabled={saving}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>
                  <strong>Enable AI Copilot for this agency</strong>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
                    When off, the panel is visible on the Learning Hub but locked.
                  </div>
                </span>
              </label>

              <fieldset style={planFieldsetStyle} disabled={!features.aiCopilot.enabled || saving}>
                <legend style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Plan</legend>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {(['starter', 'pro'] as AiCopilotPlan[]).map((p) => (
                    <label
                      key={p}
                      style={planOptionStyle(features.aiCopilot.plan === p)}
                    >
                      <input
                        type="radio"
                        name="copilot-plan"
                        value={p}
                        checked={features.aiCopilot.plan === p}
                        onChange={() => setPlan(p)}
                        disabled={!features.aiCopilot.enabled || saving}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span>
                        <strong>{p === 'pro' ? 'Pro' : 'Starter'}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {p === 'starter'
                            ? 'Compliance copilot + per-role suggestions'
                            : 'Adds workflow agents that propose multi-step actions'}
                        </div>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {savedAt && (
            <p style={savedAtStyle}>
              Saved {savedAt.toLocaleTimeString()}.
            </p>
          )}
        </section>
      )}

      {features && (
        <NotificationsSection
          features={features}
          isAdmin={isAdmin}
          saving={saving}
          onChange={saveFeatures}
        />
      )}

      <EvvAggregatorSection isAdmin={isAdmin} />
      <SandataConfigSection isAdmin={isAdmin} />
      <HhaexchangeConfigSection isAdmin={isAdmin} />
    </div>
  );
}

// ---------- Sandata config section ----------

interface SandataCaregiverMapping {
  caregiverId: string;
  externalWorkerId: string;
}

interface SandataServiceMapping {
  internalServiceCode: string;
  hcpcsCode: string;
  hcpcsModifier: string;
  label: string;
}

interface SandataPartial {
  agencyId: string;
  providerId: string | null;
  timezone: string;
  caregivers: SandataCaregiverMapping[];
  services: SandataServiceMapping[];
  enabled: boolean;
}

interface SandataConfigSectionProps {
  isAdmin: boolean;
}

function SandataConfigSection({ isAdmin }: SandataConfigSectionProps): ReactElement {
  const [config, setConfig] = useState<SandataPartial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [providerId, setProviderId] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<SandataPartial>>('/api/agencies/me/sandata-config');
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
          setProviderId(response.data.providerId ?? '');
          setTimezone(response.data.timezone);
        } else {
          setError(response.error ?? 'Failed to load Sandata config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Sandata config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: Partial<{
    providerId: string | null;
    timezone: string;
    enabled: boolean;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
  }>): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<SandataPartial>>('/api/agencies/me/sandata-config', patch);
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Cannot enable until providerId is set.');
      } else if (err instanceof HttpError && err.status === 400) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Validation failed.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change Sandata config.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const submitIdentity = (e: React.FormEvent): void => {
    e.preventDefault();
    void save({
      providerId: providerId.trim() || null,
      timezone: timezone.trim() || 'America/New_York',
    });
  };

  if (loading) {
    return (
      <section style={sectionCardStyle}>
        <p>Loading Sandata configuration…</p>
      </section>
    );
  }

  if (!config) {
    return (
      <section style={sectionCardStyle}>
        {error && <div role="alert" style={errorBoxStyle}>{error}</div>}
      </section>
    );
  }

  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
            Sandata identity & mappings
          </h3>
          <p style={sectionSubtitleStyle}>
            Sandata Provider ID is a 9-digit numeric identifier assigned by Sandata when your
            agency registers with the PA Aggregator (or your state's Sandata-backed program).
            Per-caregiver external worker IDs and HCPCS service mappings drive the visit export.
          </p>
        </div>
        <span style={config.enabled ? activeBadgeStyle : inactiveBadgeStyle}>
          {config.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not save.</strong> {error}
        </div>
      )}

      {!isAdmin && (
        <div style={readOnlyNoticeStyle}>
          <strong>Owner-only setting.</strong> Only an agency admin can change Sandata config.
        </div>
      )}

      <form onSubmit={submitIdentity} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <fieldset style={planFieldsetStyle} disabled={!isAdmin || saving}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Identity</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Provider ID (9 digits)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{9}"
                maxLength={9}
                value={providerId}
                onChange={(e) => setProviderId(e.target.value.replace(/\D/g, ''))}
                placeholder="123456789"
                style={{ fontFamily: 'SF Mono, Menlo, monospace' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Timezone</span>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
              />
            </label>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button type="submit" disabled={!isAdmin || saving} style={{ padding: '0.5rem 1rem' }}>
              {saving ? 'Saving…' : 'Save identity'}
            </button>
          </div>
        </fieldset>
      </form>

      {isAdmin && (
        <label style={{ ...toggleRowStyle, marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
            disabled={saving || (!config.providerId && !config.enabled)}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Enable Sandata export</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              When off, the export pipeline emits no rows to Sandata. Toggling on requires
              Provider ID to be populated above.
            </div>
          </span>
        </label>
      )}

      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
        <strong>{config.caregivers.length}</strong> caregiver mapping{config.caregivers.length === 1 ? '' : 's'}
        {' · '}
        <strong>{config.services.length}</strong> service mapping{config.services.length === 1 ? '' : 's'}
      </p>

      {isAdmin && (
        <SandataCaregiverMappingsEditor
          mappings={config.caregivers}
          saving={saving}
          onCommit={(next) => save({ caregivers: next })}
        />
      )}

      {isAdmin && (
        <SandataServiceMappingsEditor
          mappings={config.services}
          saving={saving}
          onCommit={(next) => save({ services: next })}
        />
      )}

      {savedAt && (
        <p style={savedAtStyle}>
          Saved {savedAt.toLocaleTimeString()}.
        </p>
      )}
    </section>
  );
}

// ---------- Sandata caregiver mappings editor ----------

interface SandataCaregiverMappingsEditorProps {
  mappings: SandataCaregiverMapping[];
  saving: boolean;
  onCommit: (next: SandataCaregiverMapping[]) => Promise<void>;
}

function SandataCaregiverMappingsEditor({
  mappings,
  saving,
  onCommit,
}: SandataCaregiverMappingsEditorProps): ReactElement {
  const [caregivers, setCaregivers] = useState<CaregiverOption[]>([]);
  const [pickedCaregiverId, setPickedCaregiverId] = useState('');
  const [newWorkerId, setNewWorkerId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CaregiverOption[]>>('/api/staff');
        if (cancelled) return;
        if (response.success && Array.isArray(response.data)) {
          setCaregivers(response.data);
        }
      } catch {
        /* roster lookup is a convenience */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nameFor = (caregiverId: string): string => {
    const cg = caregivers.find((c) => c.id === caregiverId);
    if (!cg) return caregiverId.slice(0, 8) + '…';
    return `${cg.firstName} ${cg.lastName}`.trim();
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!pickedCaregiverId || !newWorkerId.trim()) {
      setLocalError('Pick a caregiver and enter an external worker ID.');
      return;
    }
    if (mappings.some((m) => m.caregiverId === pickedCaregiverId)) {
      setLocalError('That caregiver already has an external worker ID — remove first to change.');
      return;
    }
    const next: SandataCaregiverMapping[] = [
      ...mappings,
      { caregiverId: pickedCaregiverId, externalWorkerId: newWorkerId.trim() },
    ];
    await onCommit(next);
    setPickedCaregiverId('');
    setNewWorkerId('');
  };

  const removeMapping = async (caregiverId: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.caregiverId !== caregiverId);
    await onCommit(next);
  };

  const unmappedCaregivers = caregivers.filter(
    (c) => !mappings.some((m) => m.caregiverId === c.id),
  );

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
        Caregiver mappings
      </h4>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.6rem' }}>
        Map each RayHealth caregiver to their Sandata External Worker ID. Visits for unmapped
        caregivers are skipped at export time.
      </p>

      {localError && (
        <div role="alert" style={{ ...errorBoxStyle, marginBottom: '0.5rem' }}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Caregiver</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>External Worker ID</th>
              <th style={{ padding: '0.4rem 0.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.caregiverId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>{nameFor(m.caregiverId)}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.externalWorkerId}</td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                  <button
                    onClick={() => void removeMapping(m.caregiverId)}
                    disabled={saving}
                    style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
          No caregiver mappings yet.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Caregiver</span>
          <select
            value={pickedCaregiverId}
            onChange={(e) => setPickedCaregiverId(e.target.value)}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            <option value="">— pick a caregiver —</option>
            {unmappedCaregivers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>External Worker ID</span>
          <input
            type="text"
            value={newWorkerId}
            onChange={(e) => setNewWorkerId(e.target.value)}
            placeholder="EW-1234"
            maxLength={32}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <button
          onClick={() => void addMapping()}
          disabled={saving || !pickedCaregiverId || !newWorkerId.trim()}
          style={{ padding: '0.5rem 0.9rem', border: 'none', backgroundColor: '#0B5FB1', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
        >
          Add mapping
        </button>
      </div>
    </div>
  );
}

// ---------- Sandata service mappings editor ----------

const HCPCS_MODIFIERS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'] as const;

interface SandataServiceMappingsEditorProps {
  mappings: SandataServiceMapping[];
  saving: boolean;
  onCommit: (next: SandataServiceMapping[]) => Promise<void>;
}

function SandataServiceMappingsEditor({
  mappings,
  saving,
  onCommit,
}: SandataServiceMappingsEditorProps): ReactElement {
  const [internalCode, setInternalCode] = useState('');
  const [hcpcsCode, setHcpcsCode] = useState('T1019');
  const [hcpcsModifier, setHcpcsModifier] = useState<typeof HCPCS_MODIFIERS[number]>('U4');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!internalCode.trim() || !hcpcsCode.trim() || !label.trim()) {
      setLocalError('All fields are required.');
      return;
    }
    if (!/^[A-Z]\d{4}$/.test(hcpcsCode.trim())) {
      setLocalError('HCPCS code must be 1 letter + 4 digits (e.g. T1019).');
      return;
    }
    if (mappings.some((m) => m.internalServiceCode === internalCode.trim())) {
      setLocalError('That internal service code is already mapped — remove first to change.');
      return;
    }
    const next: SandataServiceMapping[] = [
      ...mappings,
      {
        internalServiceCode: internalCode.trim(),
        hcpcsCode: hcpcsCode.trim().toUpperCase(),
        hcpcsModifier,
        label: label.trim(),
      },
    ];
    await onCommit(next);
    setInternalCode('');
    setLabel('');
  };

  const removeMapping = async (code: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.internalServiceCode !== code);
    await onCommit(next);
  };

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
        Service mappings
      </h4>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.6rem' }}>
        Map each RayHealth internal service code to a Sandata HCPCS code + modifier.
        PA typically uses T1019 + U4 (personal care), U5 (respite), U7 (companion).
      </p>

      {localError && (
        <div role="alert" style={{ ...errorBoxStyle, marginBottom: '0.5rem' }}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Internal</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>HCPCS</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Modifier</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.internalServiceCode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.internalServiceCode}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.hcpcsCode}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.hcpcsModifier}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>{m.label}</td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                  <button
                    onClick={() => void removeMapping(m.internalServiceCode)}
                    disabled={saving}
                    style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
          No service mappings yet.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Internal code</span>
          <input
            type="text"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="PERSONAL_CARE"
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>HCPCS code</span>
          <input
            type="text"
            value={hcpcsCode}
            onChange={(e) => setHcpcsCode(e.target.value.toUpperCase())}
            placeholder="T1019"
            maxLength={5}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Modifier</span>
          <select
            value={hcpcsModifier}
            onChange={(e) => setHcpcsModifier(e.target.value as typeof HCPCS_MODIFIERS[number])}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            {HCPCS_MODIFIERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Personal Care"
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
        </label>
        <button
          onClick={() => void addMapping()}
          disabled={saving || !internalCode.trim() || !hcpcsCode.trim() || !label.trim()}
          style={{ padding: '0.5rem 0.9rem', border: 'none', backgroundColor: '#0B5FB1', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------- EVV aggregator section ----------

type EvvAggregatorValue = 'sandata' | 'hhaexchange' | 'none';

interface EvvConfig {
  agencyId: string;
  aggregator: EvvAggregatorValue;
  stateCode: string;
  productionReady: boolean;
  choiceAvailable: boolean;
  stateDefaultAggregator: EvvAggregatorValue;
}

interface EvvAggregatorSectionProps {
  isAdmin: boolean;
}

function EvvAggregatorSection({ isAdmin }: EvvAggregatorSectionProps): ReactElement {
  const [config, setConfig] = useState<EvvConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<EvvConfig>>('/api/agencies/me/evv-config');
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
        } else {
          setError(response.error ?? 'Failed to load EVV config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load EVV config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (next: { aggregator: EvvAggregatorValue; productionReady?: boolean }): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<EvvConfig>>('/api/agencies/me/evv-config', next);
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'This change is not allowed for your state.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change the EVV aggregator.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section style={sectionCardStyle}>
        <p>Loading EVV configuration…</p>
      </section>
    );
  }

  if (!config) {
    return (
      <section style={sectionCardStyle}>
        {error && <div role="alert" style={errorBoxStyle}>{error}</div>}
      </section>
    );
  }

  const choices: Array<{ value: EvvAggregatorValue; label: string; sub: string }> = [
    { value: 'sandata', label: 'Sandata', sub: 'PA, NY, OH (default), MA, GA — Provider ID required' },
    { value: 'hhaexchange', label: 'HHAeXchange', sub: 'NJ (sole), available in PA — Tax ID + Provider ID required' },
    { value: 'none', label: 'Not configured', sub: 'Exports stay in dry-run until set.' },
  ];

  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
            EVV aggregator
          </h3>
          <p style={sectionSubtitleStyle}>
            Selects which state-mandated EVV aggregator the visit export pipeline routes
            to for this agency. Mappings and Provider IDs live in their own sections.
            State: <strong>{config.stateCode}</strong>
            {!config.choiceAvailable && (
              <> — your state forces <strong>{config.stateDefaultAggregator}</strong>.</>
            )}
          </p>
        </div>
        <span style={config.productionReady ? activeBadgeStyle : inactiveBadgeStyle}>
          {config.productionReady ? 'Production' : 'Dry-run'}
        </span>
      </div>

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not save.</strong> {error}
        </div>
      )}

      {!isAdmin && (
        <div style={readOnlyNoticeStyle}>
          <strong>Owner-only setting.</strong> Only an agency admin can change the EVV aggregator.
        </div>
      )}

      <fieldset
        style={planFieldsetStyle}
        disabled={!isAdmin || saving || !config.choiceAvailable}
      >
        <legend style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>
          Aggregator
        </legend>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {choices.map((c) => (
            <label key={c.value} style={planOptionStyle(config.aggregator === c.value)}>
              <input
                type="radio"
                name="evv-aggregator"
                value={c.value}
                checked={config.aggregator === c.value}
                onChange={() => void save({ aggregator: c.value })}
                disabled={!isAdmin || saving || !config.choiceAvailable}
                style={{ marginRight: '0.5rem' }}
              />
              <span>
                <strong>{c.label}</strong>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.sub}</div>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {isAdmin && config.aggregator !== 'none' && (
        <label style={{ ...toggleRowStyle, marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={config.productionReady}
            onChange={(e) => void save({
              aggregator: config.aggregator,
              productionReady: e.target.checked,
            })}
            disabled={saving}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Production-ready</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              When off, the export pipeline runs in dry-run — visits are validated against
              the aggregator's spec but no submission file is generated. Flip on once your
              Provider ID is registered and mappings are populated.
            </div>
          </span>
        </label>
      )}

      {savedAt && (
        <p style={savedAtStyle}>
          Saved {savedAt.toLocaleTimeString()}.
        </p>
      )}
    </section>
  );
}

// ---------- Notifications section ----------

interface NotificationsSectionProps {
  features: AgencyFeatures;
  isAdmin: boolean;
  saving: boolean;
  onChange: (next: AgencyFeatures) => void | Promise<void>;
}

function NotificationsSection({ features, isAdmin, saving, onChange }: NotificationsSectionProps): ReactElement {
  const n = features.notifications;

  const update = (patch: Partial<NotificationsFlag>): void => {
    void onChange({
      ...features,
      notifications: { ...n, ...patch },
    });
  };

  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>Notifications</h3>
          <p style={sectionSubtitleStyle}>
            Coordinator digests, caregiver push, family email. v2 stub — preferences persist but
            delivery wires up when the notification service ships.
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div style={readOnlyNoticeStyle}>
          <strong>Owner-only setting.</strong> Only agency admins can change notification preferences.
        </div>
      )}

      <fieldset style={planFieldsetStyle} disabled={!isAdmin || saving}>
        <legend style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Coordinator digest</legend>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {(['off', 'daily', 'weekly'] as NotificationDigest[]).map((d) => (
            <label key={d} style={planOptionStyle(n.coordinatorDigest === d)}>
              <input
                type="radio"
                name="coordinator-digest"
                value={d}
                checked={n.coordinatorDigest === d}
                onChange={() => update({ coordinatorDigest: d })}
                disabled={!isAdmin || saving}
                style={{ marginRight: '0.5rem' }}
              />
              <strong>{d === 'off' ? 'Off' : d === 'daily' ? 'Daily' : 'Weekly'}</strong>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={n.caregiverPush}
            onChange={(e) => update({ caregiverPush: e.target.checked })}
            disabled={!isAdmin || saving}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Caregiver push notifications</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              Visit reminders, training due-soon, schedule changes — pushed to the caregiver mobile app.
            </div>
          </span>
        </label>

        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={n.caregiverEmail}
            onChange={(e) => update({ caregiverEmail: e.target.checked })}
            disabled={!isAdmin || saving}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Caregiver email</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              Same content as push, delivered by email for caregivers who prefer email.
            </div>
          </span>
        </label>

        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={n.familyEmail}
            onChange={(e) => update({ familyEmail: e.target.checked })}
            disabled={!isAdmin || saving}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Family email</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              Daily visit summary emails to family members on the client's authorized contact list.
              Requires family-portal opt-in per client.
            </div>
          </span>
        </label>
      </div>
    </section>
  );
}

// ---------- HHAeXchange config section ----------

interface HhaexchangeCaregiverMapping {
  caregiverId: string;
  employeeId: string;
}

interface HhaexchangeServiceMapping {
  internalServiceCode: string;
  hhaServiceCode: string;
  label: string;
}

interface HhaexchangePartial {
  agencyId: string;
  agencyTaxId: string | null;
  hhaProviderId: string | null;
  timezone: string;
  caregivers: HhaexchangeCaregiverMapping[];
  services: HhaexchangeServiceMapping[];
  enabled: boolean;
}

interface HhaexchangeConfigSectionProps {
  isAdmin: boolean;
}

function HhaexchangeConfigSection({ isAdmin }: HhaexchangeConfigSectionProps): ReactElement {
  const [config, setConfig] = useState<HhaexchangePartial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Form state — initialized from the stored config on load.
  const [taxId, setTaxId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<HhaexchangePartial>>(
          '/api/agencies/me/hhaexchange-config',
        );
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
          setTaxId(response.data.agencyTaxId ?? '');
          setProviderId(response.data.hhaProviderId ?? '');
          setTimezone(response.data.timezone);
        } else {
          setError(response.error ?? 'Failed to load HHAeXchange config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load HHAeXchange config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: Partial<{
    agencyTaxId: string | null;
    hhaProviderId: string | null;
    timezone: string;
    enabled: boolean;
  }>): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<HhaexchangePartial>>(
        '/api/agencies/me/hhaexchange-config',
        patch,
      );
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Cannot enable until identity fields are set.');
      } else if (err instanceof HttpError && err.status === 400) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Validation failed.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change HHAeXchange config.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const submitIdentity = (e: React.FormEvent): void => {
    e.preventDefault();
    void save({
      agencyTaxId: taxId.trim() || null,
      hhaProviderId: providerId.trim() || null,
      timezone: timezone.trim() || 'America/New_York',
    });
  };

  if (loading) {
    return (
      <section style={sectionCardStyle}>
        <p>Loading HHAeXchange configuration…</p>
      </section>
    );
  }

  if (!config) {
    return (
      <section style={sectionCardStyle}>
        {error && <div role="alert" style={errorBoxStyle}>{error}</div>}
      </section>
    );
  }

  const identityComplete = Boolean(config.agencyTaxId && config.hhaProviderId);

  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
            HHAeXchange identity & mappings
          </h3>
          <p style={sectionSubtitleStyle}>
            Required for NJ and any PA agency that picks HHAeXchange. The agency Tax ID
            (EIN, 9 digits no dash) and HHAeXchange Provider ID are issued by HHAeXchange
            when your agency registers. Caregiver and service mappings are managed
            elsewhere — this section covers identity and the master enable switch.
          </p>
        </div>
        <span style={config.enabled ? activeBadgeStyle : inactiveBadgeStyle}>
          {config.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {error && (
        <div role="alert" style={errorBoxStyle}>
          <strong>Could not save.</strong> {error}
        </div>
      )}

      {!isAdmin && (
        <div style={readOnlyNoticeStyle}>
          <strong>Owner-only setting.</strong> Only an agency admin can change HHAeXchange config.
        </div>
      )}

      <form onSubmit={submitIdentity} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <fieldset style={planFieldsetStyle} disabled={!isAdmin || saving}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>Identity</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Agency Tax ID (EIN, 9 digits)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{9}"
                maxLength={9}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))}
                placeholder="123456789"
                style={{ fontFamily: 'SF Mono, Menlo, monospace' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>HHAeXchange Provider ID</span>
              <input
                type="text"
                maxLength={32}
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="P-100"
                style={{ fontFamily: 'SF Mono, Menlo, monospace' }}
              />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </label>
          <div style={{ marginTop: '0.75rem' }}>
            <button type="submit" disabled={!isAdmin || saving} style={{ padding: '0.5rem 1rem' }}>
              {saving ? 'Saving…' : 'Save identity'}
            </button>
          </div>
        </fieldset>
      </form>

      {isAdmin && (
        <label style={{ ...toggleRowStyle, marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
            disabled={saving || (!identityComplete && !config.enabled)}
            style={{ width: '18px', height: '18px' }}
          />
          <span>
            <strong>Enable HHAeXchange export</strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
              When off, the export pipeline emits no rows to HHAeXchange even if the EVV
              aggregator picker is set to HHAeXchange. Toggling on requires Tax ID and
              Provider ID to be populated above.
            </div>
          </span>
        </label>
      )}

      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
        <strong>{config.caregivers.length}</strong> caregiver mapping{config.caregivers.length === 1 ? '' : 's'}
        {' · '}
        <strong>{config.services.length}</strong> service mapping{config.services.length === 1 ? '' : 's'}
      </p>

      {isAdmin && (
        <HhaexchangeCaregiverMappingsEditor
          mappings={config.caregivers}
          saving={saving}
          onCommit={async (nextCaregivers) => {
            setSaving(true);
            setError(null);
            try {
              const response = await putJson<ApiResponse<HhaexchangePartial>>(
                '/api/agencies/me/hhaexchange-config',
                { caregivers: nextCaregivers },
              );
              if (response.success && response.data) {
                setConfig(response.data);
                setSavedAt(new Date());
              } else {
                setError(response.error ?? 'Failed to save caregiver mappings');
              }
            } catch (err) {
              if (err instanceof HttpError && err.status === 400) {
                const body = err.body as { error?: string } | null;
                setError(body?.error ?? 'Caregiver mapping validation failed.');
              } else {
                setError(err instanceof Error ? err.message : 'Failed to save caregiver mappings');
              }
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {isAdmin && (
        <HhaexchangeServiceMappingsEditor
          mappings={config.services}
          saving={saving}
          onCommit={async (nextServices) => {
            setSaving(true);
            setError(null);
            try {
              const response = await putJson<ApiResponse<HhaexchangePartial>>(
                '/api/agencies/me/hhaexchange-config',
                { services: nextServices },
              );
              if (response.success && response.data) {
                setConfig(response.data);
                setSavedAt(new Date());
              } else {
                setError(response.error ?? 'Failed to save service mappings');
              }
            } catch (err) {
              if (err instanceof HttpError && err.status === 400) {
                const body = err.body as { error?: string } | null;
                setError(body?.error ?? 'Service mapping validation failed.');
              } else {
                setError(err instanceof Error ? err.message : 'Failed to save service mappings');
              }
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {savedAt && (
        <p style={savedAtStyle}>
          Saved {savedAt.toLocaleTimeString()}.
        </p>
      )}
    </section>
  );
}

// ---------- Caregiver mappings editor ----------

interface CaregiverOption {
  id: string;
  firstName: string;
  lastName: string;
  status?: string;
}

interface CaregiverMappingsEditorProps {
  mappings: HhaexchangeCaregiverMapping[];
  saving: boolean;
  onCommit: (next: HhaexchangeCaregiverMapping[]) => Promise<void>;
}

function HhaexchangeCaregiverMappingsEditor({
  mappings,
  saving,
  onCommit,
}: CaregiverMappingsEditorProps): ReactElement {
  const [caregivers, setCaregivers] = useState<CaregiverOption[]>([]);
  const [pickedCaregiverId, setPickedCaregiverId] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CaregiverOption[]>>('/api/staff');
        if (cancelled) return;
        if (response.success && Array.isArray(response.data)) {
          setCaregivers(response.data);
        }
      } catch {
        // Roster lookup is a convenience — UI still works with raw UUIDs if needed.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nameFor = (caregiverId: string): string => {
    const cg = caregivers.find((c) => c.id === caregiverId);
    if (!cg) return caregiverId.slice(0, 8) + '…';
    return `${cg.firstName} ${cg.lastName}`.trim();
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!pickedCaregiverId || !newEmployeeId.trim()) {
      setLocalError('Pick a caregiver and enter an employee ID.');
      return;
    }
    if (mappings.some((m) => m.caregiverId === pickedCaregiverId)) {
      setLocalError('That caregiver already has an employee ID mapped — remove it first to change.');
      return;
    }
    const next: HhaexchangeCaregiverMapping[] = [
      ...mappings,
      { caregiverId: pickedCaregiverId, employeeId: newEmployeeId.trim() },
    ];
    await onCommit(next);
    setPickedCaregiverId('');
    setNewEmployeeId('');
  };

  const removeMapping = async (caregiverId: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.caregiverId !== caregiverId);
    await onCommit(next);
  };

  const unmappedCaregivers = caregivers.filter(
    (c) => !mappings.some((m) => m.caregiverId === c.id),
  );

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
        Caregiver mappings
      </h4>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.6rem' }}>
        Map each RayHealth caregiver to their HHAeXchange Employee ID. Without these,
        the export pipeline can't emit rows for that caregiver.
      </p>

      {localError && (
        <div role="alert" style={{ ...errorBoxStyle, marginBottom: '0.5rem' }}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Caregiver</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Employee ID</th>
              <th style={{ padding: '0.4rem 0.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.caregiverId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>{nameFor(m.caregiverId)}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.employeeId}</td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                  <button
                    onClick={() => void removeMapping(m.caregiverId)}
                    disabled={saving}
                    style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
          No caregiver mappings yet.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Caregiver</span>
          <select
            value={pickedCaregiverId}
            onChange={(e) => setPickedCaregiverId(e.target.value)}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            <option value="">— pick a caregiver —</option>
            {unmappedCaregivers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>HHAeXchange Employee ID</span>
          <input
            type="text"
            value={newEmployeeId}
            onChange={(e) => setNewEmployeeId(e.target.value)}
            placeholder="E-1234"
            maxLength={32}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <button
          onClick={() => void addMapping()}
          disabled={saving || !pickedCaregiverId || !newEmployeeId.trim()}
          style={{ padding: '0.5rem 0.9rem', border: 'none', backgroundColor: '#0B5FB1', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
        >
          Add mapping
        </button>
      </div>
    </div>
  );
}

// ---------- Service mappings editor ----------

interface ServiceMappingsEditorProps {
  mappings: HhaexchangeServiceMapping[];
  saving: boolean;
  onCommit: (next: HhaexchangeServiceMapping[]) => Promise<void>;
}

function HhaexchangeServiceMappingsEditor({
  mappings,
  saving,
  onCommit,
}: ServiceMappingsEditorProps): ReactElement {
  const [internalCode, setInternalCode] = useState('');
  const [hhaServiceCode, setHhaServiceCode] = useState('');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!internalCode.trim() || !hhaServiceCode.trim() || !label.trim()) {
      setLocalError('All three fields are required.');
      return;
    }
    if (mappings.some((m) => m.internalServiceCode === internalCode.trim())) {
      setLocalError('That internal service code is already mapped — remove it first to change.');
      return;
    }
    const next: HhaexchangeServiceMapping[] = [
      ...mappings,
      {
        internalServiceCode: internalCode.trim(),
        hhaServiceCode: hhaServiceCode.trim(),
        label: label.trim(),
      },
    ];
    await onCommit(next);
    setInternalCode('');
    setHhaServiceCode('');
    setLabel('');
  };

  const removeMapping = async (code: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.internalServiceCode !== code);
    await onCommit(next);
  };

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
        Service mappings
      </h4>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.6rem' }}>
        Map each RayHealth internal service code to the HHAeXchange service code your
        state Medicaid program assigned for that service. Visits with unmapped service
        codes are skipped at export time.
      </p>

      {localError && (
        <div role="alert" style={{ ...errorBoxStyle, marginBottom: '0.5rem' }}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Internal code</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>HHA code</th>
              <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.internalServiceCode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.internalServiceCode}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'SF Mono, Menlo, monospace' }}>{m.hhaServiceCode}</td>
                <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>{m.label}</td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                  <button
                    onClick={() => void removeMapping(m.internalServiceCode)}
                    disabled={saving}
                    style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
          No service mappings yet.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Internal code</span>
          <input
            type="text"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="PERSONAL_CARE"
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>HHAeXchange code</span>
          <input
            type="text"
            value={hhaServiceCode}
            onChange={(e) => setHhaServiceCode(e.target.value)}
            placeholder="1051"
            maxLength={16}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Personal Care"
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
        </label>
        <button
          onClick={() => void addMapping()}
          disabled={saving || !internalCode.trim() || !hhaServiceCode.trim() || !label.trim()}
          style={{ padding: '0.5rem 0.9rem', border: 'none', backgroundColor: '#0B5FB1', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const sectionCardStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  marginBottom: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginBottom: '1rem',
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.85rem',
  color: '#64748b',
  lineHeight: 1.5,
  maxWidth: '480px',
};

const activeBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  backgroundColor: '#E1F5EE',
  color: '#085041',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inactiveBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  backgroundColor: '#F1EFE8',
  color: '#5F5E5A',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  cursor: 'pointer',
  padding: '0.75rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
};

const planFieldsetStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  margin: 0,
};

const planOptionStyle = (selected: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: '200px',
  padding: '0.75rem 0.9rem',
  border: selected ? '2px solid #534AB7' : '1px solid #e2e8f0',
  borderRadius: '8px',
  cursor: 'pointer',
  backgroundColor: selected ? '#EEEDFE' : '#ffffff',
  display: 'flex',
  alignItems: 'flex-start',
});

const readOnlyNoticeStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#FAEEDA',
  borderLeft: '4px solid #BA7517',
  color: '#633806',
  borderRadius: '6px',
  fontSize: '0.9rem',
};

const savedAtStyle: React.CSSProperties = {
  marginTop: '1rem',
  fontSize: '0.75rem',
  color: 'var(--color-text-muted, #94a3b8)',
  textAlign: 'right',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  marginBottom: '1rem',
};

// Silence unused-import warning — postJson stays imported in case the
// settings page grows to need a non-PUT mutation later.
void postJson;
