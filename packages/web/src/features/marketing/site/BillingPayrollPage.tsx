import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Billing & Payroll.
 * ROADMAP / in-development capability — not yet live. This page is intentionally
 * honest about that: it describes where RayHealth is heading (turning verified
 * visits into clean claims and payroll-ready exports), framed as "coming to
 * RayHealth," not as a shipped feature.
 */

const capabilities = [
  { t: 'Visit-to-claim reconciliation', b: 'Match every billable line back to a verified EVV visit, so a claim only goes out when there is a clock-in, clock-out, and task record behind it.',
    i: mkic(<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /><path d="M9 11l2 2 4-4" /></>) },
  { t: 'Unit & rate validation', b: 'Check authorized units, service codes, and contracted rates before a claim is built — catching over-billed units and wrong rates while they are still fixable.',
    i: mkic(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>) },
  { t: 'Denial-risk flags before submission', b: 'Surface the patterns that get claims rejected — missing EVV, lapsed authorization, mismatched payer details — as warnings up front, not as remittance surprises.',
    i: mkic(<><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>) },
  { t: 'Payroll-ready exports', b: 'Turn the same verified visit hours into clean exports for your payroll provider — visit time, mileage, and pay rules totaled per caregiver, per period.',
    i: mkic(<><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>) },
  { t: 'EVV-status checks', b: 'Every line carries its verification state — verified, manual edit, or unmatched — so billers can see at a glance which visits are defensible and which need a look.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>) },
  { t: 'One exceptions queue', b: 'Instead of spreadsheets per payer, every claim and payroll item that needs attention lands in a single worklist — sorted by why it is stuck and what it is worth.',
    i: mkic(<><path d="M3 6h18M3 12h18M3 18h12" /><circle cx="19" cy="18" r="2" /></>) },
] as const;

const lifecycle = [
  { n: '01', t: 'Visit verified', b: 'A caregiver clocks in and out with EVV; tasks and time are captured against the authorization. This is live in RayHealth today.' },
  { n: '02', t: 'Reconcile', b: 'Planned: each verified visit is matched to its authorized service line, units, and rate — the foundation a clean claim is built on.' },
  { n: '03', t: 'Validate & flag', b: 'Planned: units, rates, and EVV status are checked, and denial-risk lines are flagged for review before anything is submitted.' },
  { n: '04', t: 'Build the claim', b: 'Planned: clean lines are assembled into a payer-ready claim, with the verified visit evidence attached underneath each line.' },
  { n: '05', t: 'Submit & track', b: 'Planned: claims move out and their status comes back into one view — accepted, pending, or denied with a reason.' },
  { n: '06', t: 'Export payroll', b: 'Planned: the same verified hours flow into a payroll-ready export, so billing and pay are reconciled against one source of truth.' },
] as const;

const faqs = [
  { q: 'Is billing & payroll available in RayHealth today?', a: 'Not yet. Billing & payroll is on our roadmap and actively in development — it is not a live feature. What is live today is the verified-visit foundation it depends on: EVV capture, task records, and the audit trail. We are building billing on top of that, and we will not describe it as shipped until it is.' },
  { q: 'What is the timeline?', a: 'We are building incrementally, starting with visit-to-claim reconciliation and EVV-status checks, then validation and exports. Exact dates depend on agency partner feedback, so we are not putting a hard ship date on this page. If you want to influence the order we ship in, talk to us in a demo — early partners help shape the build.' },
  { q: 'Will it replace my clearinghouse or payroll provider?', a: 'No. The goal is to make verified visits claim- and payroll-ready and to flag problems before submission — then hand clean data to the clearinghouse and payroll systems you already use. RayHealth is the verification and reconciliation layer, not your check-cutter.' },
  { q: 'Why build billing on top of EVV at all?', a: 'Because denials and clawbacks usually trace back to a visit that was not properly verified. By starting from RayHealth’s live EVV and audit trail, every billed line can point to the clock-in, clock-out, and task record behind it — which is exactly what makes a claim defensible.' },
] as const;

const Chrome = ({ url }: { url: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '0 4px 14px' }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
    <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--mut)', fontWeight: 500 }}>{url}</span>
  </div>
);

const pill = (bg: string, c: string, text: string) => (
  <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '.2rem .5rem', borderRadius: 999, background: bg, color: c }}>{text}</span>
);

type ClaimRow = { n: string; d: string; s: string; c: string; bg: string };

const claimRows: readonly ClaimRow[] = [
  { n: 'M. Santos · PCA · 4.0 units', d: 'EVV verified · rate matches authorization', s: 'Ready', c: '#16a34a', bg: '#e7f6ec' },
  { n: 'A. Brooks · PCA · 6.0 units', d: 'Units exceed authorization by 1.0 — review', s: 'Needs review', c: '#b45309', bg: '#fdf1e3' },
  { n: 'R. Vance · Respite · 3.0 units', d: 'No matching EVV visit — cannot submit', s: 'Blocked', c: '#b91c1c', bg: '#fdecec' },
  { n: 'D. Okafor · PCA · 2.0 units', d: 'EVV verified · rate matches authorization', s: 'Ready', c: '#16a34a', bg: '#e7f6ec' },
] as const;

export function BillingPayrollPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions · Billing &amp; payroll</span>
          <h1 className="mk-h1">From verified visit to clean claim — coming to RayHealth.</h1>
          <p className="mk-lead">
            Billing &amp; payroll is the next module we&rsquo;re building on top of RayHealth&rsquo;s live EVV and audit
            trail. The idea is simple: a claim should only go out when there&rsquo;s a verified visit behind every
            line. This is on our roadmap and in active development — not a shipped feature yet, and we&rsquo;ll be
            straight with you about where it stands.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">Roadmap · in development</span>
          </div>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Talk to us about the roadmap</Link>
            <Link to="/solutions/electronic-visit-verification" className="mk-btn mk-ghost">See what&rsquo;s live: EVV</Link>
          </div>
        </div>
      </header>

      {/* Honest framing band */}
      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <div style={{ display: 'flex', gap: '.8rem', alignItems: 'flex-start', maxWidth: '70ch' }}>
            <span style={{ color: 'var(--accent-deep)', flexShrink: 0, marginTop: 2 }}>{mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>)}</span>
            <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: 'var(--ink-soft)' }}>
              <strong style={{ color: 'var(--ink)' }}>Where this stands.</strong>{' '}
              EVV capture, task records, and the tamper-evident audit trail are live in RayHealth today. The
              billing &amp; payroll capabilities described below are planned and in development. We publish this
              page so you can see the direction and help shape it — not because it&rsquo;s ready to turn on.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">On the roadmap</p>
          <h2 className="mk-h2">What we&rsquo;re building.</h2>
          <p className="mk-deck">Each capability below is in development, designed to turn the verified visits RayHealth already captures into claims and payroll you can defend.</p>
          <div className="mk-grid">
            {capabilities.map((c) => (
              <div className="mk-card" key={c.t}>
                <div className="mk-ficon">{c.i}</div>
                <h3>{c.t}</h3>
                <p>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dive with crafted claim-status visual */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Claim status · planned view</p>
              <h3>Every line, scored before it&rsquo;s sent.</h3>
              <p>
                The view we&rsquo;re designing puts each billable line in one of three states — ready, needs review,
                or blocked — based on EVV status, authorized units, and contracted rate. The intent: never submit a
                claim that can&rsquo;t point to a verified visit. This is a design preview of in-development work.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Ready — EVV verified, units and rate match authorization</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Needs review — a fixable discrepancy, flagged with the reason</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Blocked — no matching EVV visit, so it cannot be submitted</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Claims (preview)" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 4, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>Claim batch · Jun 16–22</div>
                  {pill('var(--accent-tint)', 'var(--accent-deep)', 'Preview')}
                </div>
                {claimRows.map((r, i) => (
                  <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.6rem', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div><div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{r.n}</div><div style={{ color: 'var(--mut)', fontSize: '.72rem' }}>{r.d}</div></div>
                    {pill(r.bg, r.c, r.s)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">Payroll exports · planned</p>
              <h3>The same verified hours, ready for pay.</h3>
              <p>
                Because billing and payroll would both read from one verified-visit record, the hours you pay on and
                the units you bill on come from the same source — no double entry, no reconciling two systems by hand.
                This export is part of the in-development module, not yet live.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Visit time totaled per caregiver, per pay period</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Mileage and pay rules applied from the verified record</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Clean handoff to the payroll provider you already use</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="Payroll export · pay period 06/16–06/22 (preview)" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                {[
                  { l: 'Verified visit hours', v: '312.5 hrs' },
                  { l: 'Mileage reimbursable', v: '184 mi' },
                  { l: 'Caregivers in period', v: '27' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--ink-soft)' }}>{r.l}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.9rem', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, display: 'flex', gap: '.6rem', alignItems: 'center', padding: 12, background: 'var(--accent-tint)', borderRadius: 10 }}>
                  <span style={{ color: 'var(--accent-deep)', flexShrink: 0 }}>{mkic(MK_CHECK)}</span>
                  <div style={{ fontSize: '.82rem', color: 'var(--accent-deep)', lineHeight: 1.5, fontWeight: 600 }}>Every line traces to a verified EVV visit.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Claim lifecycle */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Planned claim lifecycle</p>
          <h2 className="mk-h2">From clock-out to clean claim.</h2>
          <p className="mk-deck">Step 01 is live today. Steps 02 through 06 describe the billing &amp; payroll module we&rsquo;re building on top of it.</p>
          <div className="mk-steps" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {lifecycle.map((s) => (
              <div className="mk-step" key={s.n}>
                <div className="sn">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">Billing &amp; payroll, honestly.</h2></div>
          <div className="mk-faqs">
            {faqs.map((f) => (
              <div className="mk-faq" key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Help shape billing &amp; payroll.</h2>
            <p>It&rsquo;s on the roadmap and in development. Early agency partners get to influence what we ship first — and see the verified-visit foundation it&rsquo;s built on, live today.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/solutions/electronic-visit-verification" className="mk-btn mk-outline">Explore EVV</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
