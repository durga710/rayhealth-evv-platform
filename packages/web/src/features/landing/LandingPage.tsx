import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  CalendarRange,
  MapPin,
  ClipboardList,
  ScrollText,
  Receipt,
  GraduationCap,
  Check,
  CircleDot,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const stats = [
  { value: '30s', label: 'Haptic clock-in' },
  { value: '<5m', label: 'GPS accuracy' },
  { value: '6/6', label: 'Cures Act elements' },
  { value: '100%', label: 'PA DHS aligned' },
];

const features = [
  {
    icon: CalendarRange,
    name: 'Scheduling',
    body: 'Drag visits onto the week. Credential and authorization conflicts are caught as you build.',
  },
  {
    icon: MapPin,
    name: 'EVV by default',
    body: 'GPS-verified clock-in and clock-out, accurate to a few meters. All six federal EVV elements captured on every visit.',
  },
  {
    icon: ClipboardList,
    name: 'Care plans & tasks',
    body: 'PA task codes 106–256 built in. Goals and duty codes the caregiver actually reads before the visit starts.',
  },
  {
    icon: ScrollText,
    name: 'Audit trail',
    body: 'Every state change — login, logout, CSRF failure, PHI read — is appended to an immutable event log with actor, outcome, and payload.',
  },
  {
    icon: Receipt,
    name: 'Billing readiness',
    roadmap: true,
    body: 'Spot claim blockers before they reach the payer — units, dates, EVV status, and documentation gaps surfaced in one queue.',
  },
  {
    icon: GraduationCap,
    name: 'EVV Academy',
    roadmap: true,
    body: 'Lessons, quizzes, and certificate renewals for caregivers and coordinators — compliant training, not an afterthought.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Build the care plan',
    body: 'Import authorizations from Sandata or PROMISe and turn them into reusable visit templates with PA-coded tasks.',
  },
  {
    n: '02',
    title: 'Assign a credentialed caregiver',
    body: 'The eligibility engine blocks any assignment whose caregiver has expired TB screening, background check, training, or license.',
  },
  {
    n: '03',
    title: 'Verify the visit at the door',
    body: 'Caregivers clock in from the mobile app with GPS — accuracy, identity, time, and service code captured for all six EVV elements.',
  },
  {
    n: '04',
    title: 'Approve, file, audit',
    body: 'Coordinators clear exceptions, and every state-changing event lands in an immutable audit log keyed by agency, actor, and entity.',
  },
];

const compliance = [
  { name: '21st Century Cures Act', detail: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { name: 'PA DHS / PROMISe', detail: 'Built around PA personal-assistance and home-health tracks; task codes 106–256 are first-class.' },
  { name: 'HIPAA', detail: 'PHI is scoped per agency and capability. Sessions are JWT; passwords are bcrypt cost 12.' },
  { name: 'Sandata aggregator ready', detail: 'EVV records map cleanly to the federal element schema for downstream submission.' },
  { name: 'Audit-grade trail', detail: 'Immutable events record actor, entity, payload, and timestamp for every state change.' },
  { name: 'Operational guardrails', detail: 'Rate-limited auth, advisory-locked first-admin creation, CORS scoped to allowlisted origins.' },
];

const roadmap = [
  {
    phase: 'Now',
    title: 'Pennsylvania operating core',
    detail: 'Admin login, PA task library, clients, authorizations, templates, assignments, EVV review, and audit events.',
  },
  {
    phase: 'Next',
    title: 'Caregiver mobile completion loop',
    detail: 'Tighter clock-in/out, offline queue visibility, caregiver assignment list, and field exception submission.',
  },
  {
    phase: 'Then',
    title: 'Aggregator submission readiness',
    detail: 'Normalize EVV records for Sandata/PROMISe export, rejection handling, and audit evidence packets.',
  },
  {
    phase: 'Later',
    title: 'State expansion without dilution',
    detail: 'Add state policy profiles only when credentialing, geofence, retention, and aggregator rules are modeled explicitly.',
  },
];

const resources = [
  {
    title: 'CMS EVV guidance',
    type: 'Federal rulebook',
    href: 'https://www.medicaid.gov/medicaid/home-community-based-services/home-community-based-services-guidance-additional-resources/electronic-visit-verification',
  },
  {
    title: 'Pennsylvania DHS EVV',
    type: 'State operating model',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv',
  },
  {
    title: 'PA EVV FAQ',
    type: 'Provider questions',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv/faq-evv',
  },
  {
    title: 'HIPAA Security Rule',
    type: 'Privacy and security',
    href: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
  },
];

const faqs = [
  {
    q: 'Why Pennsylvania-only?',
    a: 'Each state encodes EVV differently. Staying scoped to PA lets us ship deeper compliance — operating tracks, PROMISe codes, credential rules — instead of a lowest-common-denominator product.',
  },
  {
    q: 'How is this different from a scheduling tool?',
    a: 'Scheduling is one slice. RayHealth ties it to authorization units, caregiver credentials, GPS-verified visits, and an immutable audit trail — the workflow auditors actually look at.',
  },
  {
    q: 'What if a caregiver loses signal during a visit?',
    a: 'The mobile app queues clock-in/out and switches to telephony fallback. Coordinators see the visit flagged with an exception they can approve.',
  },
  {
    q: 'Can families log in?',
    a: 'Yes — with a read-only role scoped to a single client. They cannot see other clients, schedules, or staff records.',
  },
];

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>
  );
}

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <div className="mb-12 max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground md:text-[2.5rem] md:leading-[1.1]">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
        R
      </span>
      RayHealth
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-primary">
        EVV
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Header() {
  const nav = [
    ['#inside', "What's inside"],
    ['#how', 'How it works'],
    ['#compliance', 'Compliance'],
    ['#roadmap', 'Roadmap'],
    ['#faq', 'FAQ'],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <a href="#main" className="focus-visible:outline-2 focus-visible:outline-ring">
          <Wordmark />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium md:flex">
          {nav.map(([href, label]) => (
            <a key={href} href={href} className="text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#demo">Book a demo</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:px-8 md:py-28">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Operations-grade home care — Pennsylvania
          </span>
          <h1 className="text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-[clamp(3.25rem,5.4vw,4.75rem)]">
            Care, finally on the same page.
          </h1>
          <p className="text-pretty max-w-xl text-lg leading-relaxed text-muted-foreground">
            Scheduling, EVV, authorizations, credentialing, and audit — connected in one calm
            workspace built for Pennsylvania home care agencies.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#demo">
                Book a demo
                <ArrowRight className="ml-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#inside">See what's inside</a>
            </Button>
          </div>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            HIPAA-compliant infrastructure
          </p>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  const visits = [
    { name: 'Margaret Cole', time: '9:00 AM', state: 'Verified', tone: 'ok' as const },
    { name: 'Harold Vance', time: '11:30 AM', state: 'In progress', tone: 'live' as const },
    { name: 'Doris Whitfield', time: '2:00 PM', state: 'GPS drift', tone: 'warn' as const },
  ];
  const toneClass = {
    ok: 'bg-success-subtle text-success-subtle-foreground',
    live: 'bg-info-subtle text-info-subtle-foreground',
    warn: 'bg-warning-subtle text-warning-subtle-foreground',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6" aria-label="Visit command center preview">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Today</p>
          <p className="mt-0.5 font-display text-base font-semibold text-foreground">Field operations</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">PA DHS mode</span>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {visits.map((v) => (
          <li key={v.name} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{v.time}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[v.tone]}`}>
              {v.state}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">GPS accuracy</p>
          <p className="mt-1 font-display text-lg font-semibold text-foreground tabular-nums">±4 m</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">EVV elements</p>
          <p className="mt-1 font-display text-lg font-semibold text-foreground tabular-nums">6 / 6</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <span>Audit event</span>
        <code className="rounded bg-card px-1.5 py-0.5 font-medium text-foreground">visit.exception.created</code>
        <span>· actor · agency · payload</span>
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <section className="border-b border-border" aria-label="Platform metrics">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border border-x border-border md:grid-cols-4 md:divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-8 text-center">
            <div className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums md:text-4xl">
              {s.value}
            </div>
            <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Inside() {
  return (
    <section id="inside" className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="What's inside"
          title="One workspace. Every workflow."
          lead="Roadmap items are tagged honestly — no overclaiming."
        />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.name} className="flex flex-col gap-3 bg-card p-7 transition-colors hover:bg-accent/40">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {f.roadmap ? (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Roadmap
                    </span>
                  ) : null}
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{f.name}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-muted/30 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="How it works"
          title="Authorization to audit-ready visit, in four steps."
          lead="Each step feeds the next, so coordinators stop reconciling spreadsheets and start clearing exceptions."
        />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n} className="rounded-2xl border border-border bg-card p-6">
              <span className="font-display text-sm font-semibold text-primary tabular-nums">{step.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Compliance() {
  return (
    <section id="compliance" className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Compliance"
          title="Built for the framework auditors actually use."
          lead="Compliance isn't a feature toggle — it's the schema, the validation layer, and the audit trail."
        />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {compliance.map((c) => (
            <li key={c.name} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-foreground">{c.name}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RoadmapSection() {
  return (
    <section id="roadmap" className="border-y border-border bg-muted/30 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Roadmap"
          title="Shipped first. Sequenced honestly."
          lead="Keep the Pennsylvania core dependable, close the caregiver mobile loop, then harden aggregator submission."
        />
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {roadmap.map((item, i) => (
            <li key={item.phase} className="relative rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <CircleDot className={`size-4 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {item.phase}
                </span>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Resources() {
  return (
    <section id="resources" className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Resources"
          title="The receipts, not just the pitch."
          lead="The source materials we use to keep the product honest while we harden the workflows."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r) => (
            <li key={r.title}>
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {r.type}
                </span>
                <span className="inline-flex items-center justify-between gap-2 font-display text-base font-semibold text-foreground">
                  {r.title}
                  <ExternalLink
                    className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="border-y border-border bg-muted/30 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHead eyebrow="FAQ" title="Common questions." />
        <div className="flex flex-col gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="demo" className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center md:px-12">
        <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          See it run on your hardest workflow.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          A live walkthrough of the admin portal and the caregiver mobile flow. We'll bring sample
          data — you bring the edge cases.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href="mailto:hello@rayhealthevv.com">
              Book a demo
              <ArrowRight className="ml-1" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <Wordmark />
        <span>Pennsylvania-only · HIPAA-aware · 21st Century Cures Act aligned</span>
        <span>&copy; {new Date().getFullYear()} RayHealth EVV</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <StatsStrip />
        <Inside />
        <HowItWorks />
        <Compliance />
        <RoadmapSection />
        <Resources />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
