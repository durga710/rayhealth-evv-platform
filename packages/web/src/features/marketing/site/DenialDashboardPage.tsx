import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Denial dashboard — the standalone wedge.
 * Pitch: bring the 835 remittance files your payers already send you, and get
 * a denial dashboard + worklist without switching anything else. Names no
 * competitor; the enemy is the PDF-and-spreadsheet reconciliation ritual.
 */

const STEPS = [
  {
    n: '01',
    title: 'Post your 835s',
    body: 'Upload the electronic remittance files your payers or clearinghouse already produce — or connect the clearinghouse once and RayHealth pulls them automatically every six hours.',
  },
  {
    n: '02',
    title: 'See the denial picture',
    body: 'Denial rate, dollars at risk, and your top denial reasons in plain English — every CARC adjustment code translated, ranked by what it is costing you.',
  },
  {
    n: '03',
    title: 'Work every denial to done',
    body: 'Each denied or underpaid claim lands on a worklist: new, working, resubmitted, appealed, resolved, written off. Notes stay with the claim; nothing lives in someone’s head.',
  },
];

const CHECKS = [
  'Works from your remittance files alone — no claims need to be generated in RayHealth',
  'Every CARC/RARC code translated to plain English and ranked by dollars',
  'Aging view so a 60-day-old denial cannot hide',
  'Worklist status and notes, with every change in a tamper-evident audit trail',
  'Automatic 835 retrieval from your clearinghouse, or manual upload — both work',
];

const FAQS = [
  {
    q: 'Do we have to move our billing to use this?',
    a: 'No. The dashboard works entirely from posted 835 remittance files. Keep generating claims wherever you do today — the denials still show up here, translated and tracked.',
  },
  {
    q: 'What is an 835, and do we have one?',
    a: 'The 835 (electronic remittance advice) is the machine-readable version of the payment PDF you already download. Every payer and clearinghouse produces them. If you are reconciling from PDFs, you already have 835s available — they are just going unused.',
  },
  {
    q: 'What happens when we want more than denials?',
    a: 'The dashboard sits on the same platform as EVV, scheduling, claims, and payroll. When you are ready, the rest is a switch away — and your remittance history comes with you, already in place.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No. RayHealth is month-to-month. Start with denials, stay because it works.',
  },
];

export function DenialDashboardPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Denial dashboard</span>
          <h1 className="mk-h1">See your denials. Keep your system.</h1>
          <p className="mk-lead">
            Your payers already tell you exactly why every claim was denied or shaved — in 835
            files nobody reads. Post them to RayHealth and get a live denial dashboard and a
            worklist that tracks every dollar to resolution. No platform switch required.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">See it with your 835s</Link>
            <Link to="/compare" className="mk-btn mk-ghost">Compare the old way</Link>
          </div>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <span className="mk-eylabel">How it works</span>
          <h2 className="mk-h2">From payment files to worked denials.</h2>
          <div className="mk-steps" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {STEPS.map((s) => (
              <div className="mk-step" key={s.n}>
                <span className="sn">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <span className="mk-eylabel">What you get</span>
              <h3>The denial meeting, without the spreadsheet prep.</h3>
              <p>
                Most agencies discover denials when the deposit is short, then spend a morning
                reconstructing why from portal screens and PDFs. The dashboard does that
                reconstruction continuously, from the files themselves.
              </p>
              <ul className="mk-checks">
                {CHECKS.map((item) => (
                  <li key={item}>
                    <span className="mk-ck">{mkic(MK_CHECK)}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mk-visual" aria-hidden>
              <div style={{ padding: '18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.78rem', lineHeight: 2.1, color: 'var(--color-text-secondary)' }}>
                <div>denial rate <span style={{ color: 'var(--color-accent-dark)', fontWeight: 600 }}>11.2%</span> · at risk <span style={{ color: 'var(--color-accent-dark)', fontWeight: 600 }}>$14,380</span></div>
                <div>CO/197 — precert absent <span style={{ color: 'var(--color-text-muted)' }}>$6,210 · 9×</span></div>
                <div>CO/45 — exceeds fee schedule <span style={{ color: 'var(--color-text-muted)' }}>$4,660 · 21×</span></div>
                <div>CO/16 — info missing <span style={{ color: 'var(--color-text-muted)' }}>$2,110 · 6×</span></div>
                <div style={{ color: 'var(--color-text-muted)' }}>worklist · 12 open · 3 resubmitted</div>
                <div style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>✓ $3,890 recovered this month</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-sec mk-alt tight">
        <div className="mk-wrap">
          <div className="mk-center">
            <span className="mk-eylabel">Questions agencies ask</span>
            <h2 className="mk-h2">Straight answers.</h2>
          </div>
          <div className="mk-faqs">
            {FAQS.map((f) => (
              <div className="mk-faq" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Bring one month of 835s to the demo.</h2>
            <p>
              We will post them live and show you your own denial rate, your top reasons, and the
              dollars sitting in the worklist — before you commit to anything.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/switch" className="mk-btn mk-outline">How switching works later</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
