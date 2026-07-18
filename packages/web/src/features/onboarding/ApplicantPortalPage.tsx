import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

interface PortalDocument {
  id: string;
  documentType: string;
  status: 'requested' | 'submitted' | 'verified' | 'rejected';
  fileName: string | null;
  submittedAt: string | null;
}

interface PortalState {
  applicant: { firstName: string; lastName: string; position: string; status: string };
  agencyName: string;
  interview: { status: 'pending' | 'in_progress' | 'completed'; questionsRemaining: number };
  documents: PortalDocument[];
}

const DOC_LABELS: Record<string, string> = {
  photo_id: 'Photo ID',
  ssn_card: 'SSN Card',
  tb_test: 'TB Test',
  cpr_cert: 'CPR Certification',
  drivers_license: "Driver's License",
  background_check_consent: 'Background Check Consent',
  employment_eligibility: 'Employment Eligibility (I-9)',
};

const STATUS_STYLE: Record<PortalDocument['status'], { label: string; color: string; bg: string }> = {
  requested: { label: 'Needed', color: '#9A3412', bg: '#FFF7ED' },
  submitted: { label: 'Submitted — under review', color: '#1D4ED8', bg: '#EFF6FF' },
  verified: { label: 'Verified', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Rejected — please re-upload', color: '#BE123C', bg: '#FFF1F2' },
};

const ACCEPTED = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The applicant's own portal (token = their interview session token): finish
 * the AI interview and upload every requested onboarding document. This page
 * is what makes the admin-side "request document" flow real.
 */
export function ApplicantPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalState | null>(null);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/portal/${token ?? ''}`);
      if (!res.ok) {
        setError('This portal link is not valid. Please use the link from your application.');
        return;
      }
      setPortal((await res.json()) as PortalState);
    } catch {
      setError('Network error. Please refresh to try again.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (doc: PortalDocument, file: File) => {
    setRowError((prev) => ({ ...prev, [doc.id]: '' }));
    if (file.size > MAX_BYTES) {
      setRowError((prev) => ({ ...prev, [doc.id]: 'File is larger than 5 MB.' }));
      return;
    }
    setUploadingId(doc.id);
    try {
      const res = await fetch(
        `/api/onboarding/portal/${token ?? ''}/documents/${doc.id}?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        },
      );
      if (!res.ok) {
        let msg = 'Upload failed. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) msg = body.message;
        } catch { /* keep default */ }
        setRowError((prev) => ({ ...prev, [doc.id]: msg }));
        return;
      }
      await load();
    } catch {
      setRowError((prev) => ({ ...prev, [doc.id]: 'Network error. Please try again.' }));
    } finally {
      setUploadingId(null);
    }
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', color: '#334155' }}>{error}</div>
      </div>
    );
  }
  if (!portal) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Loading your portal…
      </div>
    );
  }

  const interviewDone = portal.interview.status === 'completed';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B' }}>
          {portal.agencyName} · Applicant portal
        </p>
        <h1 style={{ margin: '0.35rem 0 0.25rem', fontSize: '1.6rem', fontWeight: 800 }}>
          Welcome, {portal.applicant.firstName}!
        </h1>
        <p style={{ margin: 0, color: '#475569' }}>
          {portal.applicant.position} application · status:{' '}
          <strong style={{ textTransform: 'capitalize' }}>{portal.applicant.status.replace(/_/g, ' ')}</strong>
        </p>

        <section style={{ marginTop: '1.5rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 800 }}>1 · Your interview</h2>
          {interviewDone ? (
            <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>
              ✓ Interview complete. Thanks — the team will review your responses.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 0.85rem', color: '#475569' }}>
                A short guided interview ({portal.interview.questionsRemaining} question
                {portal.interview.questionsRemaining === 1 ? '' : 's'} remaining). It takes about ten minutes.
              </p>
              <Link
                to={`/interview/${token}`}
                style={{ display: 'inline-block', background: '#107480', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '0.6rem 1.1rem', textDecoration: 'none' }}
              >
                {portal.interview.status === 'pending' ? 'Start interview' : 'Continue interview'}
              </Link>
            </>
          )}
        </section>

        <section style={{ marginTop: '1.25rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 800 }}>2 · Your documents</h2>
          <p style={{ margin: '0 0 1rem', color: '#475569', fontSize: '0.9rem' }}>
            Upload a clear photo or PDF of each item (max 5 MB). You can re-upload anything that gets rejected.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {portal.documents.map((doc) => {
              const style = STATUS_STYLE[doc.status];
              const canUpload = doc.status === 'requested' || doc.status === 'rejected';
              return (
                <div key={doc.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{DOC_LABELS[doc.documentType] ?? doc.documentType}</div>
                      {doc.fileName && (
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Uploaded: {doc.fileName}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: style.color, background: style.bg, borderRadius: 999, padding: '0.25rem 0.7rem' }}>
                        {style.label}
                      </span>
                      {canUpload && (
                        <>
                          <input
                            ref={(el) => { fileInputs.current[doc.id] = el; }}
                            type="file"
                            accept={ACCEPTED}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void upload(doc, f);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingId === doc.id}
                            onClick={() => fileInputs.current[doc.id]?.click()}
                            style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontWeight: 700, cursor: 'pointer', opacity: uploadingId === doc.id ? 0.6 : 1 }}
                          >
                            {uploadingId === doc.id ? 'Uploading…' : doc.status === 'rejected' ? 'Re-upload' : 'Upload'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {rowError[doc.id] && (
                    <div role="alert" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#BE123C' }}>
                      {rowError[doc.id]}
                    </div>
                  )}
                </div>
              );
            })}
            {portal.documents.length === 0 && (
              <p style={{ margin: 0, color: '#94A3B8' }}>No documents have been requested yet.</p>
            )}
          </div>
        </section>

        <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.75rem', color: '#94A3B8' }}>
          Keep this page's link private — it is your access to this application.
        </p>
      </div>
    </div>
  );
}
