import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';

/* ── data ── */

const stats = [
  { value: '30s', label: 'Haptic clock-in' },
  { value: '<5m', label: 'GPS accuracy' },
  { value: '6/6', label: 'Cures Act elements' },
  { value: '100%', label: 'PA DHS aligned' },
];

const features = [
  { title: 'Scheduling', body: 'Drag visits onto the week. Credential and authorization conflicts are caught as you build.', live: true,
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
  { title: 'EVV by default', body: 'GPS-verified clock-in and clock-out, accurate to a few meters. All six federal EVV elements on every visit.', live: true,
    icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
  { title: 'Care plans & tasks', body: 'PA task codes 106–256 built in. Goals and duty codes the caregiver reads before the visit starts.', live: true,
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></> },
  { title: 'Audit trail', body: 'Every state change is appended to an immutable event log with actor, outcome, and payload.', live: true,
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> },
  { title: 'Billing readiness', body: 'Spot claim blockers before they reach the payer — units, dates, EVV status, and gaps in one queue.', live: false,
    icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></> },
  { title: 'EVV Academy', body: 'Lessons, quizzes, and certificate renewals for caregivers and coordinators — compliant training built in.', live: false,
    icon: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></> },
];

const steps = [
  { n: '01', title: 'Import authorizations', body: 'Pull from Sandata or PROMISe into reusable visit templates with PA-coded tasks.' },
  { n: '02', title: 'Assign credentialed staff', body: 'The eligibility engine blocks any assignment with an expired screen, check, or training record.' },
  { n: '03', title: 'Verify at the door', body: 'Caregivers clock in via GPS — all six federal EVV elements captured automatically.' },
  { n: '04', title: 'Approve, file, audit', body: 'Clear exceptions; every change lands in an immutable audit log keyed by agency and actor.' },
];

const compliance = [
  { badge: 'CURES', name: '21st Century Cures Act', body: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { badge: 'PA DHS', name: 'PA DHS / PROMISe', body: 'PA personal-assistance and home-health tracks; task codes 106–256 are first-class.' },
  { badge: 'HIPAA', name: 'HIPAA', body: 'PHI scoped per agency. HttpOnly sessions, bcrypt cost-12, append-only audit log.' },
  { badge: 'EVV', name: 'Sandata aggregator', body: 'EVV records map to the federal element schema for downstream submission.' },
];

const marquee = ['Sandata', 'PROMISe', 'HIPAA', 'Cures Act', 'PA DHS', 'GPS-verified', 'Immutable audit', 'CSRF-hardened', 'Offline retry', 'Telephony fallback'];
const ROTATE = ['scheduling.', 'EVV.', 'authorizations.', 'credentialing.', 'audits.'];

/* ── styles (scoped, self-contained — main has no Tailwind) ── */

const CSS = `
.lz{--bg:#06060d;--ink:#ececf6;--mut:#9a9ab2;--v:#8b5cf6;--c:#22d3ee;--p:#ec4899;--card:rgba(255,255,255,.045);--line:rgba(255,255,255,.09);
  background:var(--bg);color:var(--ink);min-height:100vh;overflow-x:hidden;position:relative;font-family:var(--font-body),system-ui,-apple-system,sans-serif;}
.lz *{box-sizing:border-box;}
.lz-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
.lz-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55;mix-blend-mode:screen;}
.lz-orb.a{width:46vw;height:46vw;left:-8vw;top:-6vw;background:radial-gradient(circle,#7c3aed,transparent 70%);animation:drift1 22s ease-in-out infinite;}
.lz-orb.b{width:42vw;height:42vw;right:-10vw;top:4vw;background:radial-gradient(circle,#22d3ee,transparent 70%);animation:drift2 26s ease-in-out infinite;}
.lz-orb.c{width:40vw;height:40vw;left:25vw;top:34vw;background:radial-gradient(circle,#ec4899,transparent 70%);animation:drift3 30s ease-in-out infinite;opacity:.4;}
@keyframes drift1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(8vw,6vw) scale(1.15)}}
@keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-7vw,5vw) scale(1.1)}}
@keyframes drift3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(5vw,-6vw) scale(1.2)}}
.lz-gridbg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
  background-size:54px 54px;-webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 30%,transparent 75%);}
.lz-main{position:relative;z-index:1;}
.lz-wrap{max-width:1180px;margin:0 auto;padding:0 1.5rem;}
.lz-nav{position:sticky;top:0;z-index:40;backdrop-filter:blur(14px);background:rgba(6,6,13,.6);border-bottom:1px solid var(--line);}
.lz-navin{max-width:1180px;margin:0 auto;padding:.9rem 1.5rem;display:flex;align-items:center;justify-content:space-between;}
.lz-brand{font-weight:800;font-size:1.15rem;letter-spacing:-.02em;color:#fff;text-decoration:none;display:flex;gap:.5rem;align-items:center;}
.lz-chip{font-size:.6rem;font-weight:800;letter-spacing:.18em;padding:3px 7px;border-radius:6px;background:linear-gradient(135deg,var(--v),var(--c));color:#fff;}
.lz-navlinks{display:flex;gap:.35rem;align-items:center;}
.lz-navlinks a{color:var(--mut);text-decoration:none;font-weight:500;font-size:.875rem;padding:.4rem .8rem;border-radius:8px;transition:color .2s,background .2s;}
.lz-navlinks a:hover{color:#fff;background:rgba(255,255,255,.06);}
.lz-cta{background:linear-gradient(135deg,var(--v),var(--c))!important;color:#fff!important;font-weight:700!important;box-shadow:0 8px 30px rgba(124,58,237,.45);transition:transform .2s,box-shadow .2s;}
.lz-cta:hover{transform:translateY(-2px);box-shadow:0 12px 44px rgba(34,211,238,.55);}
.lz-ghost{border:1px solid var(--line)!important;color:var(--ink)!important;background:rgba(255,255,255,.03)!important;transition:background .2s,border-color .2s;}
.lz-ghost:hover{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.25)!important;}
.lz-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 1.6rem;border-radius:12px;text-decoration:none;font-size:.95rem;}
.lz-hero{text-align:center;padding:6.5rem 0 4.5rem;}
.lz-eyebrow{display:inline-flex;align-items:center;gap:.55rem;padding:.4rem 1rem;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#c4b5fd;}
.lz-dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;box-shadow:0 0 12px 2px #22d3ee;animation:pulse 1.8s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}
.lz-h1{font-size:clamp(2.8rem,7.5vw,5.6rem);line-height:.98;font-weight:800;letter-spacing:-.04em;margin:1.6rem 0 0;
  background:linear-gradient(110deg,#fff 10%,#c4b5fd 35%,#22d3ee 55%,#ec4899 75%,#fff 95%);background-size:280% auto;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:flow 7s linear infinite;}
@keyframes flow{to{background-position:280% center}}
.lz-rot{display:inline-block;vertical-align:bottom;min-width:8ch;text-align:left;}
.lz-rot span{display:inline-block;background:linear-gradient(135deg,var(--v),var(--c));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;animation:rotup .5s cubic-bezier(.6,0,.2,1);}
@keyframes rotup{from{transform:translateY(60%);opacity:0}to{transform:translateY(0);opacity:1}}
.lz-sub{max-width:620px;margin:1.5rem auto 0;color:var(--mut);font-size:1.15rem;line-height:1.6;}
.lz-actions{display:flex;gap:.85rem;justify-content:center;flex-wrap:wrap;margin-top:2rem;}
.lz-trust{margin-top:1.4rem;color:var(--mut);font-size:.8rem;display:inline-flex;gap:.45rem;align-items:center;}
.lz-card{max-width:760px;margin:3.5rem auto 0;border-radius:20px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));
  backdrop-filter:blur(18px);padding:1.4rem;box-shadow:0 40px 120px rgba(124,58,237,.25);position:relative;overflow:hidden;animation:float 7s ease-in-out infinite;}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
.lz-card::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.13),transparent);animation:sweep 5s ease-in-out infinite;}
@keyframes sweep{0%{left:-60%}55%,100%{left:130%}}
.lz-cardhead{display:flex;justify-content:space-between;align-items:center;padding-bottom:1rem;border-bottom:1px solid var(--line);}
.lz-row{display:flex;justify-content:space-between;align-items:center;padding:.7rem 0;border-bottom:1px solid rgba(255,255,255,.05);opacity:0;animation:rowin .6s ease forwards;}
@keyframes rowin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
.lz-pill{font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:999px;}
.lz-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:.5rem;}
.lz-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#22d3ee,#8b5cf6);width:0;animation:fill 2.4s ease forwards .4s;}
@keyframes fill{to{width:68%}}
.lz-marq{margin-top:5rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:1.1rem 0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
.lz-track{display:flex;gap:3rem;width:max-content;animation:marq 26s linear infinite;}
.lz-track span{color:var(--mut);font-weight:600;font-size:.95rem;white-space:nowrap;display:inline-flex;gap:.6rem;align-items:center;}
.lz-track span::before{content:"";width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,var(--v),var(--c));}
@keyframes marq{to{transform:translateX(-50%)}}
.lz-sec{padding:6rem 0;}
.lz-kick{font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
  background:linear-gradient(135deg,var(--v),var(--c));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.lz-h2{font-size:clamp(1.9rem,4vw,3rem);font-weight:800;letter-spacing:-.03em;margin:.8rem 0 0;line-height:1.08;color:#fff;}
.lz-lead{color:var(--mut);font-size:1.05rem;line-height:1.6;margin:1rem 0 0;max-width:560px;}
.lz-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.1rem;margin-top:3rem;}
.lz-fcard{border-radius:16px;border:1px solid var(--line);background:var(--card);padding:1.6rem;position:relative;overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s;}
.lz-fcard:hover{transform:translateY(-6px);border-color:rgba(139,92,246,.5);box-shadow:0 20px 60px rgba(124,58,237,.28);}
.lz-fcard::before{content:"";position:absolute;inset:0;background:radial-gradient(400px circle at var(--mx,50%) var(--my,0%),rgba(139,92,246,.18),transparent 60%);opacity:0;transition:opacity .25s;}
.lz-fcard:hover::before{opacity:1;}
.lz-ficon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(34,211,238,.18));border:1px solid var(--line);color:#c4b5fd;}
.lz-statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-top:3rem;}
.lz-stat{background:rgba(10,10,20,.6);padding:1.8rem 1.25rem;text-align:center;}
.lz-statv{font-size:2.4rem;font-weight:800;letter-spacing:-.03em;background:linear-gradient(135deg,#fff,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.lz-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.1rem;margin-top:3rem;}
.lz-step{border-radius:16px;border:1px solid var(--line);background:var(--card);padding:1.6rem;}
.lz-stepn{font-size:2.6rem;font-weight:800;letter-spacing:-.04em;background:linear-gradient(135deg,var(--v),var(--c));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
.lz-final{text-align:center;border-radius:28px;margin:5rem 0;padding:5rem 1.5rem;position:relative;overflow:hidden;border:1px solid var(--line);
  background:radial-gradient(800px circle at 50% 0%,rgba(139,92,246,.3),transparent 60%),linear-gradient(180deg,rgba(255,255,255,.04),transparent);}
.lz-foot{border-top:1px solid var(--line);padding:2.2rem 0;color:var(--mut);font-size:.82rem;position:relative;z-index:1;}
.lz-footin{max-width:1180px;margin:0 auto;padding:0 1.5rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;align-items:center;}
.lz-foot a{color:var(--mut);text-decoration:none;}.lz-foot a:hover{color:#fff;}
.lz-banner{background:linear-gradient(135deg,rgba(124,58,237,.25),rgba(34,211,238,.18));color:#fff;text-align:center;padding:.55rem 1rem;font-size:.78rem;font-weight:600;border-bottom:1px solid var(--line);position:relative;z-index:1;}
.lz-banner a{color:#fff;text-decoration:underline;text-underline-offset:3px;}
.reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
@media (prefers-reduced-motion:reduce){.lz *{animation:none!important}.reveal{opacity:1;transform:none}}
`;

/* ── component ── */

export function LandingPage() {
  const [rot, setRot] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setRot((r) => (r + 1) % ROTATE.length), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.reveal');
    if (!els || !('IntersectionObserver' in window)) {
      els?.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div className="lz" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lz-orbs" aria-hidden><div className="lz-orb a" /><div className="lz-orb b" /><div className="lz-orb c" /></div>
      <div className="lz-gridbg" aria-hidden />

      <div className="lz-banner">Now live for Pennsylvania agencies — <Link to="/launch">see what shipped →</Link></div>

      <nav className="lz-nav">
        <div className="lz-navin">
          <Link to="/" className="lz-brand">RayHealth<span className="lz-chip">EVV</span></Link>
          <div className="lz-navlinks">
            <Link to="/pricing">Pricing</Link>
            <Link to="/demo">Demo</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/login" className="lz-btn lz-cta" style={{ padding: '.5rem 1.1rem', fontSize: '.85rem', marginLeft: '.4rem' }}>Log in</Link>
          </div>
        </div>
      </nav>

      <main className="lz-main">
        <section className="lz-wrap lz-hero">
          <span className="lz-eyebrow"><span className="lz-dot" />Operations-grade home care · Pennsylvania</span>
          <h1 className="lz-h1">Your home-care<br />command center.</h1>
          <p className="lz-sub">
            One luminous workspace for{' '}
            <span className="lz-rot"><span key={rot}>{ROTATE[rot]}</span></span>
            <br />Scheduling, EVV, authorizations, credentialing, and audit — connected for Pennsylvania agencies.
          </p>
          <div className="lz-actions">
            <Link to="/contact" className="lz-btn lz-cta">Book a demo →</Link>
            <a href="#features" className="lz-btn lz-ghost">See what&rsquo;s inside</a>
          </div>
          <div><span className="lz-trust">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 12l2 2 4-4" /><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            HIPAA-compliant infrastructure
          </span></div>

          <div className="lz-card" aria-label="Live command center">
            <div className="lz-cardhead">
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9a9ab2' }}>Today · Field operations</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 2 }}>Live visit command center</div>
              </div>
              <span className="lz-pill" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)', color: '#fff' }}>PA DHS mode</span>
            </div>
            {[
              { name: 'Margaret Cole', t: '9:00 AM', s: 'Verified', c: '#4ade80', bg: 'rgba(34,197,94,.15)' },
              { name: 'Harold Vance', t: '11:30 AM', s: 'In progress', c: '#22d3ee', bg: 'rgba(34,211,238,.15)' },
              { name: 'Doris Whitfield', t: '2:00 PM', s: 'GPS drift', c: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
            ].map((v, i) => (
              <div className="lz-row" key={v.name} style={{ animationDelay: `${0.5 + i * 0.18}s`, textAlign: 'left' }}>
                <div><div style={{ fontWeight: 600, fontSize: '.92rem' }}>{v.name}</div><div style={{ color: '#9a9ab2', fontSize: '.78rem' }}>{v.t}</div></div>
                <span className="lz-pill" style={{ background: v.bg, color: v.c }}>{v.s}</span>
              </div>
            ))}
            <div style={{ marginTop: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#9a9ab2' }}><span>Authorization burn</span><span>68% units used</span></div>
              <div className="lz-bar"><i /></div>
            </div>
          </div>
        </section>

        <div className="lz-marq">
          <div className="lz-track">
            {[...marquee, ...marquee].map((m, i) => <span key={i}>{m}</span>)}
          </div>
        </div>

        <section id="features" className="lz-wrap lz-sec">
          <div className="reveal">
            <p className="lz-kick">What&rsquo;s inside</p>
            <h2 className="lz-h2">One workspace. Every workflow.</h2>
            <p className="lz-lead">Roadmap items tagged honestly — no overclaiming.</p>
          </div>
          <div className="lz-grid3">
            {features.map((f, i) => (
              <div className="lz-fcard reveal" key={f.title} onMouseMove={onCardMove} style={{ transitionDelay: `${i * 60}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <span className="lz-ficon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{f.icon}</svg></span>
                  {f.live
                    ? <span className="lz-pill" style={{ background: 'rgba(34,197,94,.14)', color: '#4ade80' }}>● Live</span>
                    : <span className="lz-pill" style={{ background: 'rgba(255,255,255,.06)', color: '#9a9ab2' }}>Roadmap</span>}
                </div>
                <h3 style={{ margin: '1rem 0 .4rem', fontSize: '1.05rem', fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{f.title}</h3>
                <p style={{ margin: 0, color: '#9a9ab2', fontSize: '.9rem', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>{f.body}</p>
              </div>
            ))}
          </div>
          <div className="lz-statgrid reveal">
            {stats.map((s) => (
              <div className="lz-stat" key={s.label}>
                <div className="lz-statv">{s.value}</div>
                <div style={{ fontSize: '.72rem', color: '#9a9ab2', marginTop: '.4rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="lz-wrap lz-sec">
          <div className="reveal">
            <p className="lz-kick">How it works</p>
            <h2 className="lz-h2">Authorization to audit-ready visit.</h2>
          </div>
          <div className="lz-steps">
            {steps.map((s, i) => (
              <div className="lz-step reveal" key={s.n} style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="lz-stepn">{s.n}</div>
                <h3 style={{ margin: '1rem 0 .4rem', fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{s.title}</h3>
                <p style={{ margin: 0, color: '#9a9ab2', fontSize: '.9rem', lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lz-wrap lz-sec">
          <div className="reveal">
            <p className="lz-kick">Compliance</p>
            <h2 className="lz-h2">Built for the frameworks auditors use.</h2>
          </div>
          <div className="lz-grid3">
            {compliance.map((c, i) => (
              <div className="lz-fcard reveal" key={c.name} onMouseMove={onCardMove} style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="lz-kick" style={{ fontSize: '.66rem', position: 'relative', zIndex: 1 }}>{c.badge}</div>
                <h3 style={{ margin: '.7rem 0 .4rem', fontSize: '1rem', fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{c.name}</h3>
                <p style={{ margin: 0, color: '#9a9ab2', fontSize: '.9rem', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lz-wrap">
          <div className="lz-final reveal">
            <h2 className="lz-h2" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)' }}>Retire the spreadsheets.</h2>
            <p className="lz-lead" style={{ margin: '1rem auto 0', textAlign: 'center' }}>A live walkthrough of the admin portal and the caregiver mobile flow. Bring your hardest workflow.</p>
            <div className="lz-actions">
              <Link to="/contact" className="lz-btn lz-cta">Book a demo →</Link>
              <Link to="/login" className="lz-btn lz-ghost">Access admin portal</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lz-foot">
        <div className="lz-footin">
          <span>© {new Date().getFullYear()} RayHealthEVV™ · Pennsylvania-built</span>
          <div style={{ display: 'flex', gap: '1.4rem', flexWrap: 'wrap' }}>
            <Link to="/compliance/hipaa">HIPAA</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/launch">What&rsquo;s new</Link>
          </div>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
