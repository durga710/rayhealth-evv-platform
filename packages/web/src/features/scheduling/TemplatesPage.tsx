import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface Template {
  id: string;
  clientId: string;
  name: string;
  tasks: string[];
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getJson<Template[]>('/api/templates')
      .then(data => setTemplates(data || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const tasks = taskInput.split(',').map(t => t.trim()).filter(Boolean);
      const newTemplate = await postJson<Template>('/api/templates', { clientId, name, tasks });
      setTemplates(prev => [...prev, newTemplate]);
      setClientId('');
      setName('');
      setTaskInput('');
      setMessage('Template created successfully');
    } catch (err) {
      setMessage('Failed to create template');
    }
  };

  return (
    <div>
      <h2>Visit Templates</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Create and manage plan-of-care visit templates.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>New Template</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="clientId">Client ID</label>
              <input id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="name">Template Name</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Routine" required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="tasks">Tasks (comma separated)</label>
              <input id="tasks" value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="Bathing, Dressing, Meal Prep" required />
            </div>
            
            <button type="submit">Create Template</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Template Library</h3>
          {templates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
              No templates found.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {templates.map(t => (
                <li key={t.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <strong>{t.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Client: {t.clientId.slice(0,6)}...</div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {t.tasks.map((task, i) => (
                      <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px' }}>
                        {task}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}