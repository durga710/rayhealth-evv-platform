import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

interface AgencyPublicInfo {
  agencyId: string;
  name: string;
  state: string;
  about: string | null;
}

/**
 * Public per-agency homepage at rayhealthevv.com/<slug>. This is the page an
 * agency shares on job boards and business cards: who they are + a hiring CTA
 * into the public application flow. Unknown slugs bounce to the platform
 * landing page (the route is a catch-all, so typos land here too).
 */
export function AgencyPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<AgencyPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/agency-page/${encodeURIComponent(slug ?? '')}`);
        if (!res.ok) {
          if (!cancelled) void navigate('/', { replace: true });
          return;
        }
        const data = (await res.json()) as AgencyPublicInfo;
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) void navigate('/', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  if (loading || !info) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A' }}>
      <header
        style={{
          background: '#0F172A',
          color: '#fff',
          padding: '3.5rem 1.5rem 3rem',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94A3B8' }}>
          Home care agency · {info.state}
        </p>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '2.25rem', fontWeight: 800 }}>{info.name}</h1>
        <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to={`/${slug}/apply`}
            style={{
              background: '#10B981',
              color: '#052E22',
              fontWeight: 800,
              borderRadius: 10,
              padding: '0.8rem 1.6rem',
              textDecoration: 'none',
            }}
          >
            Apply to join our care team
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.75rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', fontWeight: 800 }}>About us</h2>
          <p style={{ margin: 0, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {info.about?.trim() ||
              `${info.name} provides Medicaid home care services in Pennsylvania. We are always looking for compassionate caregivers to join our team.`}
          </p>
        </section>

        <section style={{ marginTop: '1.25rem', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.75rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', fontWeight: 800 }}>How hiring works</h2>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.9, color: '#334155' }}>
            <li>Submit your application online — it takes about two minutes.</li>
            <li>Complete a short guided interview right after you apply.</li>
            <li>Upload your documents (ID, certifications) from your applicant portal.</li>
            <li>Our team reviews everything and gets back to you.</li>
          </ol>
          <Link to={`/${slug}/apply`} style={{ display: 'inline-block', marginTop: '1rem', color: '#107480', fontWeight: 700 }}>
            Start your application →
          </Link>
        </section>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#94A3B8' }}>
          Hiring powered by RayHealth EVV
        </p>
      </main>
    </div>
  );
}
