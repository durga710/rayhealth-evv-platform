import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'renders');
const audioDir = path.join(projectRoot, 'audio');
const posterDir = path.join(projectRoot, 'posters');
const tmpDir = path.join(projectRoot, '.render-tmp');

const ffprobePath = ffprobeStatic.path;

const W = 1280;
const H = 720;
const FPS = 24;
const BRAND = {
  blue: '#1a5fa8',
  deepBlue: '#1248a0',
  teal: '#2d7dd2',
  orange: '#f97316',
  surface: '#f0f4f8',
  ink: '#1a3a5c',
  navy: '#091529',
  success: '#1F9D55',
  attention: '#f97316',
  white: '#FFFFFF',
  muted: '#7a9cbf',
  line: '#dde9f8',
  softBlue: '#e8f1fb',
  softTeal: '#eef3fa'
};

const FONT = 'Nunito, Avenir Next, Helvetica Neue, Arial, sans-serif';
const VOICE = process.env.RAYHEALTH_TTS_VOICE || 'hm_psi';
const TTS_LANG = process.env.RAYHEALTH_TTS_LANG || 'en-us';
const TTS_SPEED = process.env.RAYHEALTH_TTS_SPEED || '1.08';
const kokoroEnv = {
  ...process.env,
  PATH: `${path.join(projectRoot, '.venv', 'bin')}:${process.env.PATH || ''}`,
  PHONEMIZER_ESPEAK_LIBRARY: process.env.PHONEMIZER_ESPEAK_LIBRARY || '/opt/homebrew/lib/libespeak-ng.dylib',
  PHONEMIZER_ESPEAK_DATA_PATH: process.env.PHONEMIZER_ESPEAK_DATA_PATH || '/opt/homebrew/share/espeak-ng-data'
};

const ads = [
  {
    id: '01',
    slug: '01-hero-care-on-the-same-page',
    title: 'Care, finally on the same page.',
    duration: 30,
    voiceover:
      "Home care teams juggle a lot - schedules, visits, compliance, payroll readiness, and the people in the middle of it all. RayHealthEVV brings every part of an agency onto one calm, operations-grade platform. Scheduling. EVV. Billing. Payroll readiness. Caregiver training. Family visibility. All in one place - built for the people doing the work, not against them. RayHealthEVV. Care, finally on the same page.",
    scenes: [
      { start: 0, end: 3, type: 'care', text: '' },
      { start: 3, end: 7, type: 'desk', text: 'Agencies juggle a lot.' },
      { start: 7, end: 13, type: 'dashboard', text: 'We brought it onto one page.' },
      { start: 13, end: 19, type: 'triptych', text: 'Scheduling. EVV. Billing. Payroll readiness.' },
      { start: 19, end: 24, type: 'handoff', text: 'Built for the people doing the work.' },
      { start: 24, end: 30, type: 'end', tag: 'Care, on the same page.', url: 'rayhealthevv.com' }
    ]
  },
  {
    id: '02',
    slug: '02-agency-owner-run-the-agency',
    title: 'Run the agency, not the spreadsheet.',
    duration: 30,
    voiceover:
      "Friday at 4:48 - closing the week one tab at a time. Schedule changes. EVV exceptions. Pay period still open. RayHealthEVV brings scheduling, EVV review, billing readiness, and payroll approvals into one operations-grade platform. Conflicts resolved before they hit Monday. Compliance flagged before it bites. Pay periods closed in clicks, not hours. Run the agency. Not the spreadsheet. RayHealthEVV. Book an agency demo today.",
    scenes: [
      { start: 0, end: 3, type: 'friday', text: 'Friday, 4:48 PM.' },
      { start: 3, end: 8, type: 'clutter', text: 'Closing the week the hard way.' },
      { start: 8, end: 12, type: 'dashboard', text: 'Meet RayHealthEVV.' },
      { start: 12, end: 20, type: 'ops-list', text: 'Fewer tabs. Fewer calls. Fewer surprises.' },
      { start: 20, end: 25, type: 'laptop-close', text: 'Run the agency, not the spreadsheet.' },
      { start: 25, end: 30, type: 'end', tag: 'Book an agency demo', url: 'rayhealthevv.com/book-demo' }
    ]
  },
  {
    id: '03',
    slug: '03-caregiver-respects-your-time',
    title: 'A workday that respects your time.',
    duration: 30,
    voiceover:
      "When you walk into someone's home, the last thing they need is a caregiver staring at a clipboard. RayHealthEVV is the caregiver app that gets out of your way. One tap to clock in. Care plan ready. Tasks one-hand simple. Voice notes when typing will not do. EVV verified in the background - automatically. Less paperwork. More presence. RayHealthEVV. A workday that respects your time.",
    scenes: [
      { start: 0, end: 4, type: 'doorway', text: '' },
      { start: 4, end: 9, type: 'phone-clock', text: 'Clock-in, done.' },
      { start: 9, end: 15, type: 'phone-tasks', text: 'Care plan. Tasks. Notes - all here.' },
      { start: 15, end: 21, type: 'phone-verified', text: 'EVV happens automatically.' },
      { start: 21, end: 26, type: 'present', text: 'So you can be here.' },
      { start: 26, end: 30, type: 'end', tag: 'Caregiver app - built for the people doing the work.', url: 'rayhealthevv.com/caregivers' }
    ]
  },
  {
    id: '04',
    slug: '04-family-closer-to-the-people-you-love',
    title: 'Closer to the people you love.',
    duration: 30,
    voiceover:
      "She lives a few flights away. He is the caregiver who just made sure her morning started right. RayHealthEVV's family portal turns a phone call you forgot to make into a quiet update you can trust. Visits as they happen. Tasks completed. Tomorrow's schedule. No alarms. No surprises. Just a calmer way of staying close. RayHealthEVV. Closer to the people you love.",
    scenes: [
      { start: 0, end: 4, type: 'airport', text: 'She is two flights away.' },
      { start: 4, end: 10, type: 'home-tea', text: 'He just made sure her day starts right.' },
      { start: 10, end: 18, type: 'family-portal', text: 'RayHealthEVV family portal.' },
      { start: 18, end: 24, type: 'tablet-schedule', text: 'Real-time visibility - gentle, not loud.' },
      { start: 24, end: 30, type: 'end', tag: 'Closer to the people you love.', url: 'rayhealthevv.com/family' }
    ]
  },
  {
    id: '05',
    slug: '05-compliance-audit-ready-by-design',
    title: 'Audit-ready by design.',
    duration: 30,
    voiceover:
      "Compliance should not feel like a folder you carry into a courtroom. RayHealthEVV makes audit-readiness the default. Every visit GPS-verified. Every clock event time-stamped. Every signature stored. EVV exceptions surfaced before billing. Training certificates renewed before they lapse. State-ready exports in a single click. Twenty-first Cures Act ready, by design. RayHealthEVV. The operations-grade home care platform.",
    scenes: [
      { start: 0, end: 4, type: 'audit-folder', text: 'Audits do not have to feel like this.' },
      { start: 4, end: 10, type: 'audit-log', text: 'Every visit. Every event. Verified.' },
      { start: 10, end: 18, type: 'compliance-sequence', text: '21st Cures Act ready.' },
      { start: 18, end: 24, type: 'report-export', text: 'Built audit-ready.' },
      { start: 24, end: 30, type: 'end', tag: 'Operations-grade home care platform.', url: 'rayhealthevv.com/compliance' }
    ]
  },
  {
    id: '06',
    slug: '06-bumper-care-on-the-same-page',
    title: 'Care, on the same page.',
    duration: 6,
    voiceover: '',
    scenes: [
      { start: 0, end: 1.5, type: 'bumper-tabs', text: '' },
      { start: 1.5, end: 4, type: 'bumper-line', text: 'Care, on the same page.' },
      { start: 4, end: 6, type: 'end', tag: 'Care, on the same page.', url: 'rayhealthevv.com' }
    ]
  },
  {
    id: '07',
    slug: '07-audio-cutdown',
    title: 'Audio-only cutdown.',
    duration: 30,
    audioOnly: true,
    voiceover:
      "Home care teams juggle a lot - schedules, visits, compliance, payroll readiness, and the people in the middle of it all. RayHealthEVV brings every part of an agency onto one calm, operations-grade platform. Scheduling. EVV. Billing readiness. Payroll. Caregiver training. Family visibility. Built for the people doing the work - not against them. RayHealthEVV - care, on the same page. Learn more at rayhealthevv.com."
  }
];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function ease(t) {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function fadeForScene(p) {
  return clamp(Math.min(p / 0.16, (1 - p) / 0.12));
}

function fmt(n, digits = 3) {
  return Number(n).toFixed(digits);
}

function wrapText(text, maxWidth, size) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const average = size * 0.55;
  const maxChars = Math.max(8, Math.floor(maxWidth / average));
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (trial.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock({ text, x, y, maxWidth = 900, size = 52, fill = BRAND.ink, weight = 700, opacity = 1, anchor = 'start', lineHeight = 1.15 }) {
  if (!text) return '';
  const lines = wrapText(text, maxWidth, size);
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lineHeight}">${esc(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" opacity="${opacity}" text-anchor="${anchor}">${tspans}</text>`;
}

function pill({ x, y, w, h, text, fill = BRAND.white, stroke = BRAND.line, textFill = BRAND.ink, opacity = 1 }) {
  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      ${textBlock({ text, x: x + w / 2, y: y + h / 2 + 9, maxWidth: w - 30, size: 26, fill: textFill, weight: 700, anchor: 'middle' })}
    </g>`;
}

function checkIcon(cx, cy, r = 16, fill = BRAND.success) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/><path d="M ${cx - r * 0.45} ${cy} L ${cx - r * 0.12} ${cy + r * 0.34} L ${cx + r * 0.5} ${cy - r * 0.38}" fill="none" stroke="#fff" stroke-width="${r * 0.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function rayLogo({ x, y, scale = 1, color = BRAND.blue, textColor = BRAND.ink, opacity = 1 }) {
  const s = scale;
  const inverse = color === BRAND.white || textColor === BRAND.white;
  const iconFill = inverse ? BRAND.white : 'url(#logoIconBg)';
  const haloFill = inverse ? BRAND.white : BRAND.softBlue;
  const lineColor = inverse ? BRAND.blue : BRAND.white;
  const wordFill = inverse ? BRAND.white : 'url(#logoText)';
  const pillFill = inverse ? BRAND.orange : 'url(#evvPill)';
  return `
    <g opacity="${opacity}" transform="translate(${x} ${y}) scale(${s})">
      <circle cx="32" cy="32" r="36" fill="${haloFill}" opacity="${inverse ? '0.14' : '0.92'}"/>
      <circle cx="32" cy="32" r="28" fill="${iconFill}"/>
      <ellipse cx="32" cy="20" rx="17" ry="9" fill="${inverse ? BRAND.blue : BRAND.white}" opacity="${inverse ? '0.10' : '0.18'}"/>
      <polyline points="10,32 16,32 19,22 22,42 26,27 29,37 33,32 39,32 42,24 46,40 50,32 58,32"
        fill="none" stroke="${lineColor}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.96"/>
      <circle cx="50" cy="32" r="4.2" fill="${BRAND.orange}"/>
      <circle cx="55" cy="52" r="9" fill="${inverse ? BRAND.white : '#fff'}"/>
      <rect x="53" y="48" width="4" height="8" rx="1.5" fill="${BRAND.blue}"/>
      <rect x="50" y="51" width="10" height="4" rx="1.5" fill="${BRAND.blue}"/>
      <text x="84" y="29" font-family="${FONT}" font-size="29" font-weight="900" fill="${wordFill}" letter-spacing="-0.5">RayHealth</text>
      <rect x="86" y="40" width="58" height="23" rx="12" fill="${pillFill}"/>
      <text x="115" y="56" font-family="${FONT}" font-size="11" font-weight="850" fill="#fff" text-anchor="middle" letter-spacing="3">EVV</text>
      <text x="255" y="20" font-family="${FONT}" font-size="11" font-weight="700" fill="${inverse ? '#dbeafe' : BRAND.muted}">™</text>
    </g>`;
}

function chromeFrame({ x, y, w, h, title = 'RayHealthEVV', opacity = 1, body = '' }) {
  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <rect x="${x}" y="${y}" width="${w}" height="58" rx="24" fill="${BRAND.softBlue}"/>
      <circle cx="${x + 30}" cy="${y + 29}" r="7" fill="#EC6A5E"/>
      <circle cx="${x + 52}" cy="${y + 29}" r="7" fill="#F4BF4F"/>
      <circle cx="${x + 74}" cy="${y + 29}" r="7" fill="#61C554"/>
      <text x="${x + 105}" y="${y + 38}" font-family="${FONT}" font-size="22" font-weight="700" fill="${BRAND.ink}">${esc(title)}</text>
      ${body}
    </g>`;
}

function phoneFrame({ x, y, w = 245, h = 500, opacity = 1, body = '' }) {
  return `
    <g opacity="${opacity}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="38" fill="${BRAND.navy}"/>
      <rect x="${x + 13}" y="${y + 18}" width="${w - 26}" height="${h - 36}" rx="28" fill="${BRAND.surface}"/>
      <rect x="${x + w / 2 - 35}" y="${y + 29}" width="70" height="8" rx="4" fill="#AFC4D6"/>
      ${body}
    </g>`;
}

function footerWordmark() {
  return rayLogo({ x: 54, y: 42, scale: 0.72, color: BRAND.blue, textColor: BRAND.ink, opacity: 0.94 });
}

function background(kind = 'light') {
  if (kind === 'blue') return `<rect width="${W}" height="${H}" fill="${BRAND.blue}"/>`;
  return `
    <rect width="${W}" height="${H}" fill="${BRAND.surface}"/>
    <path d="M0 604 C230 566 366 646 576 610 C833 566 935 495 1280 538 L1280 720 L0 720 Z" fill="#EAF4FB"/>
    <path d="M0 652 C290 618 466 696 705 660 C951 623 1035 591 1280 615 L1280 720 L0 720 Z" fill="#DFF1F1" opacity="0.65"/>`;
}

function overlayText(scene, p, dark = false) {
  if (!scene.text) return '';
  const o = fadeForScene(p);
  const y = 610 - 18 * (1 - ease(clamp(p / 0.25)));
  return `
    <rect x="72" y="555" width="760" height="92" rx="24" fill="${dark ? BRAND.blue : BRAND.white}" opacity="${0.9 * o}" stroke="${dark ? BRAND.blue : BRAND.line}" stroke-width="2"/>
    ${textBlock({ text: scene.text, x: 105, y, maxWidth: 700, size: 38, fill: dark ? BRAND.white : BRAND.ink, weight: 800, opacity: o })}
  `;
}

function sceneCare(p) {
  const o = fadeForScene(p);
  const arm = 18 * ease(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="745" y="120" width="330" height="410" rx="70" fill="#FFF1DC"/>
      <path d="M790 365 C850 330 917 330 975 370" fill="none" stroke="${BRAND.ink}" stroke-width="18" stroke-linecap="round"/>
      <path d="M658 ${358 - arm} C733 ${320 - arm} 814 ${335 - arm} 888 ${394 - arm}" fill="none" stroke="${BRAND.teal}" stroke-width="22" stroke-linecap="round"/>
      <path d="M414 346 C498 308 584 317 664 382" fill="none" stroke="${BRAND.blue}" stroke-width="22" stroke-linecap="round"/>
      <circle cx="438" cy="206" r="54" fill="#F4CDA8"/>
      <circle cx="839" cy="224" r="50" fill="#E8B88B"/>
      <path d="M368 520 C399 390 482 330 586 340 C676 349 735 426 750 520" fill="${BRAND.blue}" opacity="0.9"/>
      <path d="M774 520 C790 405 862 346 946 356 C1040 368 1084 438 1100 520" fill="${BRAND.softTeal}"/>
      ${textBlock({ text: 'Home care teams deserve calm operations.', x: 93, y: 340, maxWidth: 510, size: 58, fill: BRAND.ink, weight: 800, opacity: o })}
    </g>`;
}

function sceneDesk(p, headline = 'Agencies juggle a lot.') {
  const o = fadeForScene(p);
  const shake = Math.sin(p * Math.PI * 8) * 5 * (1 - p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}" transform="translate(${shake} 0)">
      <rect x="210" y="128" width="860" height="410" rx="26" fill="#F1E5D2"/>
      <rect x="266" y="176" width="315" height="212" rx="14" fill="#fff" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="292" y="218" font-family="${FONT}" font-size="26" font-weight="800" fill="${BRAND.ink}">Weekly Schedule</text>
      ${calendarRows(296, 250, 248, 5, p)}
      <rect x="636" y="174" width="256" height="144" rx="14" fill="#FFF6D8" stroke="#E7BE62" stroke-width="2" transform="rotate(-4 764 246)"/>
      ${textBlock({ text: 'EVV exceptions', x: 662, y: 236, maxWidth: 200, size: 25, fill: BRAND.attention, weight: 800 })}
      <rect x="725" y="352" width="260" height="118" rx="14" fill="#E9F2FE" stroke="${BRAND.line}" stroke-width="2" transform="rotate(3 855 411)"/>
      ${textBlock({ text: 'Payroll approvals', x: 754, y: 417, maxWidth: 190, size: 25, fill: BRAND.ink, weight: 800 })}
      <rect x="898" y="210" width="124" height="238" rx="16" fill="${BRAND.navy}"/>
      <rect x="910" y="232" width="100" height="192" rx="10" fill="${BRAND.surface}"/>
      <rect x="926" y="274" width="68" height="12" rx="6" fill="${BRAND.attention}"/>
      <rect x="926" y="302" width="48" height="10" rx="5" fill="${BRAND.line}"/>
    </g>
    ${overlayText({ text: headline }, p)}`;
}

function calendarRows(x, y, w, count, p, green = false) {
  let rows = '';
  for (let i = 0; i < count; i += 1) {
    const rowY = y + i * 28;
    const fill = i % 2 ? '#F8FBFD' : '#FFFFFF';
    const grow = clamp((p - i * 0.08) / 0.35);
    rows += `<rect x="${x}" y="${rowY}" width="${w}" height="18" rx="7" fill="${fill}" stroke="${BRAND.line}" stroke-width="1"/>
      <rect x="${x + 10}" y="${rowY + 5}" width="${(w - 42) * ease(grow)}" height="8" rx="4" fill="${green || i > 2 ? BRAND.teal : BRAND.blue}" opacity="0.78"/>`;
  }
  return rows;
}

function sceneDashboard(p, headline = 'We brought it onto one page.') {
  const o = fadeForScene(p);
  const pop = ease(clamp((p - 0.18) / 0.25));
  const body = `
    <rect x="165" y="112" width="190" height="330" rx="18" fill="${BRAND.softBlue}"/>
    <text x="192" y="156" font-family="${FONT}" font-size="24" font-weight="800" fill="${BRAND.ink}">Today</text>
    ${calendarRows(190, 188, 125, 7, p, true)}
    <rect x="390" y="116" width="640" height="128" rx="22" fill="${BRAND.surface}" stroke="${BRAND.line}" stroke-width="2"/>
    ${metric(430, 155, 'Visits', '118', BRAND.blue, p)}
    ${metric(585, 155, 'EVV verified', '96%', BRAND.success, p)}
    ${metric(780, 155, 'Billing ready', '$42k', BRAND.teal, p)}
    <rect x="392" y="278" width="298" height="165" rx="22" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
    <text x="424" y="324" font-family="${FONT}" font-size="23" font-weight="800" fill="${BRAND.ink}">Exceptions</text>
    ${checkIcon(438, 365, 14)}
    <text x="464" y="373" font-family="${FONT}" font-size="20" font-weight="600" fill="${BRAND.muted}">Address confirmed</text>
    ${checkIcon(438, 405, 14)}
    <text x="464" y="413" font-family="${FONT}" font-size="20" font-weight="600" fill="${BRAND.muted}">Signature saved</text>
    <rect x="724" y="278" width="306" height="165" rx="22" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
    <text x="758" y="324" font-family="${FONT}" font-size="23" font-weight="800" fill="${BRAND.ink}">Payroll readiness</text>
    <rect x="758" y="356" width="${215 * pop}" height="16" rx="8" fill="${BRAND.success}"/>
    <text x="758" y="408" font-family="${FONT}" font-size="21" font-weight="700" fill="${BRAND.ink}">Period locked</text>`;
  return `
    ${background()}
    ${footerWordmark()}
    ${chromeFrame({ x: 120, y: 120, w: 1040, h: 410, opacity: o, body })}
    ${overlayText({ text: headline }, p)}`;
}

function metric(x, y, label, value, color, p) {
  const n = ease(clamp((p - 0.08) / 0.5));
  return `
    <g opacity="${n}">
      <text x="${x}" y="${y}" font-family="${FONT}" font-size="20" font-weight="700" fill="${BRAND.muted}">${esc(label)}</text>
      <text x="${x}" y="${y + 44}" font-family="${FONT}" font-size="43" font-weight="850" fill="${color}">${esc(value)}</text>
    </g>`;
}

function sceneTriptych(p) {
  const o = fadeForScene(p);
  const labels = ['Clock-in confirmed', 'Invoice ready', 'Pay period locked'];
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      ${triptychCard(95, 150, 'Scheduling', 'Today 9:00 AM', labels[0], BRAND.blue, clamp((p - 0.05) / 0.35))}
      ${triptychCard(460, 150, 'EVV', 'GPS + signature', labels[1], BRAND.teal, clamp((p - 0.22) / 0.35))}
      ${triptychCard(825, 150, 'Billing', 'Authorized export', labels[2], BRAND.success, clamp((p - 0.39) / 0.35))}
    </g>
    ${overlayText({ text: 'Scheduling. EVV. Billing. Payroll readiness.' }, p)}`;
}

function triptychCard(x, y, title, sub, label, color, p) {
  const s = 0.96 + 0.04 * ease(p);
  return `
    <g transform="translate(${x + 170 * (1 - s)} ${y + 110 * (1 - s)}) scale(${s})" opacity="${clamp(p * 1.6)}">
      <rect x="0" y="0" width="320" height="270" rx="28" fill="#fff" stroke="${BRAND.line}" stroke-width="2"/>
      <rect x="28" y="28" width="70" height="70" rx="18" fill="${color}"/>
      ${checkIcon(63, 63, 18)}
      <text x="28" y="138" font-family="${FONT}" font-size="34" font-weight="850" fill="${BRAND.ink}">${esc(title)}</text>
      <text x="28" y="176" font-family="${FONT}" font-size="23" font-weight="650" fill="${BRAND.muted}">${esc(sub)}</text>
      <rect x="28" y="210" width="250" height="34" rx="17" fill="${BRAND.softTeal}"/>
      <text x="48" y="234" font-family="${FONT}" font-size="20" font-weight="800" fill="${BRAND.ink}">${esc(label)}</text>
    </g>`;
}

function sceneHandoff(p) {
  const o = fadeForScene(p);
  const slide = 70 * (1 - ease(p));
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="198" y="168" width="884" height="330" rx="42" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <circle cx="398" cy="304" r="70" fill="#F6CFB4"/>
      <path d="M292 496 C310 392 357 356 430 358 C506 360 556 402 574 496" fill="${BRAND.blue}"/>
      <circle cx="854" cy="304" r="70" fill="#E7B28B"/>
      <path d="M748 496 C768 390 819 358 886 358 C966 358 1014 404 1032 496" fill="${BRAND.teal}"/>
      <g transform="translate(${508 + slide} 255)">
        <rect x="0" y="0" width="250" height="130" rx="20" fill="${BRAND.navy}"/>
        <rect x="16" y="18" width="218" height="94" rx="14" fill="${BRAND.surface}"/>
        ${checkIcon(54, 65, 15)}
        <text x="80" y="72" font-family="${FONT}" font-size="22" font-weight="800" fill="${BRAND.ink}">Visit ready</text>
      </g>
    </g>
    ${overlayText({ text: 'Built for the people doing the work.' }, p)}`;
}

function sceneEnd(scene, p) {
  const o = fadeForScene(p);
  const y = 326 - 22 * (1 - ease(clamp(p / 0.35)));
  const titleSize = scene.tag.length > 50 ? 30 : scene.tag.length > 36 ? 36 : 46;
  return `
    ${background('blue')}
    <g opacity="${o}">
      ${rayLogo({ x: 464, y: 162, scale: 1.30, color: BRAND.white, textColor: BRAND.white })}
      ${textBlock({ text: scene.tag, x: 640, y, maxWidth: 920, size: titleSize, fill: BRAND.white, weight: 800, anchor: 'middle' })}
      <rect x="440" y="420" width="400" height="64" rx="32" fill="${BRAND.white}" opacity="0.97"/>
      ${textBlock({ text: scene.url, x: 640, y: 462, maxWidth: 360, size: 30, fill: BRAND.blue, weight: 850, anchor: 'middle' })}
      <text x="640" y="520" font-family="${FONT}" font-size="24" font-weight="600" fill="#DCEFFF" text-anchor="middle">Scheduling • EVV • Billing readiness • Payroll approvals</text>
    </g>`;
}

function sceneFriday(p) {
  return sceneDesk(p, 'Friday, 4:48 PM.');
}

function sceneClutter(p) {
  const base = sceneDesk(p, 'Closing the week the hard way.');
  return base.replace('<rect x="636"', '<path d="M620 128 L1052 514" stroke="#D97706" stroke-width="5" opacity="0.18"/><rect x="636"');
}

function sceneOpsList(p) {
  const o = fadeForScene(p);
  const items = [
    ['Schedule conflicts auto-resolved', BRAND.blue],
    ['EVV exceptions flagged early', BRAND.attention],
    ['Billing readiness green', BRAND.success],
    ['Training certificates renewed', BRAND.teal]
  ];
  const body = items
    .map((item, i) => {
      const reveal = ease(clamp((p - 0.08 - i * 0.12) / 0.28));
      return `
        <g opacity="${reveal}">
          <rect x="285" y="${150 + i * 78}" width="710" height="54" rx="18" fill="${i % 2 ? BRAND.surface : BRAND.white}" stroke="${BRAND.line}" stroke-width="1.5"/>
          ${checkIcon(318, 177 + i * 78, 15, item[1])}
          <text x="352" y="${185 + i * 78}" font-family="${FONT}" font-size="28" font-weight="800" fill="${BRAND.ink}">${esc(item[0])}</text>
        </g>`;
    })
    .join('');
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">${body}</g>
    ${overlayText({ text: 'Fewer tabs. Fewer calls. Fewer surprises.' }, p)}`;
}

function sceneLaptopClose(p) {
  const o = fadeForScene(p);
  const lid = -28 * ease(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}" transform="translate(0 ${lid})">
      <rect x="352" y="190" width="576" height="320" rx="22" fill="${BRAND.navy}"/>
      <rect x="384" y="220" width="512" height="250" rx="12" fill="${BRAND.surface}"/>
      ${textBlock({ text: '5:00 PM', x: 640, y: 340, maxWidth: 300, size: 74, fill: BRAND.blue, weight: 850, anchor: 'middle' })}
      <rect x="304" y="510" width="672" height="28" rx="14" fill="#9DAFBE"/>
    </g>
    ${overlayText({ text: 'Run the agency, not the spreadsheet.' }, p)}`;
}

function sceneDoorway(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="756" y="92" width="310" height="500" rx="6" fill="#EAD7BE"/>
      <rect x="800" y="136" width="222" height="456" rx="8" fill="#FFF7EB"/>
      <circle cx="955" cy="356" r="9" fill="${BRAND.attention}"/>
      <circle cx="464" cy="214" r="54" fill="#DFAD89"/>
      <path d="M356 566 C371 423 426 352 504 354 C598 356 642 438 654 566" fill="${BRAND.teal}"/>
      <rect x="524" y="388" width="82" height="146" rx="22" fill="${BRAND.navy}" transform="rotate(-7 565 461)"/>
      ${textBlock({ text: 'One tap, then care comes first.', x: 100, y: 340, maxWidth: 470, size: 58, fill: BRAND.ink, weight: 850, opacity: o })}
    </g>`;
}

function scenePhoneClock(p) {
  const body = `
    <text x="478" y="170" font-family="${FONT}" font-size="22" font-weight="800" fill="${BRAND.ink}">Today visit</text>
    <rect x="458" y="208" width="184" height="54" rx="18" fill="${BRAND.blue}"/>
    <text x="550" y="244" font-family="${FONT}" font-size="23" font-weight="850" fill="#fff" text-anchor="middle">Clock In</text>
    <rect x="458" y="296" width="184" height="44" rx="15" fill="${BRAND.softTeal}"/>
    ${checkIcon(482, 318, 13)}
    <text x="506" y="326" font-family="${FONT}" font-size="17" font-weight="800" fill="${BRAND.ink}">Location confirmed</text>
    <rect x="458" y="366" width="184" height="72" rx="18" fill="#fff" stroke="${BRAND.line}" stroke-width="2"/>
    <text x="478" y="400" font-family="${FONT}" font-size="17" font-weight="800" fill="${BRAND.ink}">Care plan loaded</text>`;
  return phoneScene(p, body, 'Clock-in, done.');
}

function scenePhoneTasks(p) {
  const body = `
    <text x="478" y="170" font-family="${FONT}" font-size="22" font-weight="800" fill="${BRAND.ink}">Care plan</text>
    ${taskRow(462, 205, 'Medication reminder', true)}
    ${taskRow(462, 262, 'Light breakfast', true)}
    ${taskRow(462, 319, 'Morning walk', false)}
    <rect x="462" y="392" width="175" height="48" rx="24" fill="${BRAND.teal}"/>
    <text x="550" y="424" font-family="${FONT}" font-size="20" font-weight="850" fill="#fff" text-anchor="middle">Voice note</text>`;
  return phoneScene(p, body, 'Care plan. Tasks. Notes - all here.');
}

function taskRow(x, y, label, done) {
  return `
    <rect x="${x}" y="${y}" width="176" height="42" rx="14" fill="#fff" stroke="${BRAND.line}" stroke-width="1.5"/>
    ${done ? checkIcon(x + 22, y + 21, 11) : `<circle cx="${x + 22}" cy="${y + 21}" r="11" fill="#fff" stroke="${BRAND.line}" stroke-width="2"/>`}
    <text x="${x + 43}" y="${y + 28}" font-family="${FONT}" font-size="15" font-weight="760" fill="${BRAND.ink}">${esc(label)}</text>`;
}

function scenePhoneVerified(p) {
  const body = `
    <text x="478" y="170" font-family="${FONT}" font-size="22" font-weight="800" fill="${BRAND.ink}">Visit summary</text>
    ${checkIcon(550, 246, 48)}
    <text x="550" y="330" font-family="${FONT}" font-size="29" font-weight="850" fill="${BRAND.success}" text-anchor="middle">EVV verified</text>
    <text x="550" y="364" font-family="${FONT}" font-size="17" font-weight="700" fill="${BRAND.muted}" text-anchor="middle">GPS • time • task notes</text>
    <rect x="474" y="410" width="154" height="34" rx="17" fill="${BRAND.softBlue}"/>
    <text x="550" y="433" font-family="${FONT}" font-size="16" font-weight="800" fill="${BRAND.ink}" text-anchor="middle">Tomorrow visible</text>`;
  return phoneScene(p, body, 'EVV happens automatically.');
}

function scenePresent(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <circle cx="500" cy="236" r="55" fill="#DAA77F"/>
      <path d="M386 558 C407 410 463 354 545 360 C637 368 690 440 706 558" fill="${BRAND.teal}"/>
      <circle cx="780" cy="238" r="58" fill="#F1C5A0"/>
      <path d="M668 558 C690 411 744 358 823 362 C920 366 972 443 990 558" fill="#EAE4DA"/>
      <path d="M557 390 C620 428 688 428 751 390" stroke="${BRAND.ink}" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.25"/>
      <rect x="590" y="515" width="100" height="28" rx="14" fill="${BRAND.navy}" opacity="0.28"/>
    </g>
    ${overlayText({ text: 'So you can be here.' }, p)}`;
}

function phoneScene(p, body, headline) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g transform="translate(90 70)" opacity="${o}">
      ${phoneFrame({ x: 350, y: 52, body })}
      <rect x="705" y="125" width="330" height="320" rx="28" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="748" y="190" font-family="${FONT}" font-size="32" font-weight="850" fill="${BRAND.ink}">Caregiver app</text>
      <text x="748" y="238" font-family="${FONT}" font-size="24" font-weight="650" fill="${BRAND.muted}">Fast where it matters.</text>
      ${pill({ x: 748, y: 286, w: 220, h: 52, text: 'One-hand simple', fill: BRAND.softTeal, stroke: '#C5EDED' })}
    </g>
    ${overlayText({ text: headline }, p)}`;
}

function sceneAirport(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <path d="M760 152 h310 v350 h-310 z" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <path d="M790 438 h250" stroke="${BRAND.line}" stroke-width="7"/>
      <path d="M828 438 l-35 42 M1000 438 l35 42" stroke="${BRAND.line}" stroke-width="7"/>
      <path d="M850 252 l115 44 l-115 44 l22 -44 z" fill="${BRAND.blue}" opacity="0.82"/>
      ${phoneFrame({ x: 290, y: 140, w: 260, h: 440, body: familyNotification(313, 223) })}
    </g>
    ${overlayText({ text: 'She is two flights away.' }, p)}`;
}

function familyNotification(x, y) {
  return `
    <rect x="${x}" y="${y}" width="214" height="104" rx="20" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
    ${checkIcon(x + 32, y + 38, 14)}
    <text x="${x + 56}" y="${y + 39}" font-family="${FONT}" font-size="17" font-weight="850" fill="${BRAND.ink}">Mom's visit complete</text>
    <text x="${x + 56}" y="${y + 68}" font-family="${FONT}" font-size="14" font-weight="650" fill="${BRAND.muted}">Morning care logged</text>`;
}

function sceneHomeTea(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="230" y="380" width="820" height="62" rx="31" fill="#D8C1A8"/>
      <circle cx="460" cy="254" r="58" fill="#E6B38C"/>
      <path d="M346 444 C368 323 424 286 494 292 C572 298 620 354 638 444" fill="${BRAND.softTeal}"/>
      <circle cx="790" cy="250" r="56" fill="#F0C5A2"/>
      <path d="M682 444 C700 322 756 286 829 292 C914 299 960 360 978 444" fill="#F2E8DD"/>
      <path d="M610 358 C674 390 748 390 812 358" stroke="${BRAND.ink}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.23"/>
      <rect x="606" y="316" width="96" height="46" rx="20" fill="#fff" stroke="${BRAND.line}" stroke-width="2"/>
      <path d="M702 329 c32 0 32 28 0 28" fill="none" stroke="${BRAND.line}" stroke-width="5"/>
    </g>
    ${overlayText({ text: 'He just made sure her day starts right.' }, p)}`;
}

function sceneFamilyPortal(p) {
  const o = fadeForScene(p);
  const items = ['Visit completed', 'Medication confirmed', 'Light walk recorded', 'Tomorrow 9:00 AM'];
  const rows = items
    .map((item, i) => {
      const reveal = ease(clamp((p - 0.1 - i * 0.1) / 0.3));
      return `
        <g opacity="${reveal}">
          <rect x="460" y="${183 + i * 61}" width="360" height="46" rx="17" fill="#fff" stroke="${BRAND.line}" stroke-width="1.5"/>
          ${checkIcon(486, 206 + i * 61, 12, i === 3 ? BRAND.teal : BRAND.success)}
          <text x="512" y="${214 + i * 61}" font-family="${FONT}" font-size="21" font-weight="800" fill="${BRAND.ink}">${esc(item)}</text>
        </g>`;
    })
    .join('');
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      ${phoneFrame({ x: 190, y: 116, w: 225, h: 455, body: familyNotification(214, 205) })}
      <rect x="438" y="120" width="430" height="395" rx="30" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="480" y="158" font-family="${FONT}" font-size="26" font-weight="850" fill="${BRAND.ink}">Family timeline</text>
      ${rows}
      <rect x="908" y="196" width="140" height="96" rx="26" fill="${BRAND.softTeal}"/>
      <text x="978" y="254" font-family="${FONT}" font-size="44" font-weight="850" fill="${BRAND.teal}" text-anchor="middle">OK</text>
    </g>
    ${overlayText({ text: 'RayHealthEVV family portal.' }, p)}`;
}

function sceneTabletSchedule(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="232" y="138" width="816" height="420" rx="34" fill="${BRAND.navy}"/>
      <rect x="255" y="160" width="770" height="376" rx="22" fill="${BRAND.surface}"/>
      <text x="308" y="216" font-family="${FONT}" font-size="34" font-weight="850" fill="${BRAND.ink}">Tomorrow's care team</text>
      ${pill({ x: 310, y: 262, w: 245, h: 58, text: '9:00 AM - Morning visit', fill: '#fff' })}
      ${pill({ x: 310, y: 342, w: 245, h: 58, text: '2:00 PM - Wellness check', fill: '#fff' })}
      <rect x="620" y="260" width="330" height="142" rx="28" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="654" y="314" font-family="${FONT}" font-size="27" font-weight="850" fill="${BRAND.ink}">Gentle visibility</text>
      <text x="654" y="360" font-family="${FONT}" font-size="21" font-weight="650" fill="${BRAND.muted}">No alarms. No surprises.</text>
    </g>
    ${overlayText({ text: 'Real-time visibility - gentle, not loud.' }, p)}`;
}

function sceneAuditFolder(p) {
  const o = fadeForScene(p);
  const tilt = -4 + 4 * ease(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}" transform="rotate(${tilt} 640 350)">
      <path d="M350 190 h220 l45 48 h315 a36 36 0 0 1 36 36 v238 a36 36 0 0 1 -36 36 h-580 a36 36 0 0 1 -36 -36 v-286 a36 36 0 0 1 36 -36z" fill="#D4B487"/>
      <rect x="348" y="244" width="590" height="292" rx="28" fill="#F0D6AA"/>
      <text x="642" y="390" font-family="${FONT}" font-size="55" font-weight="850" fill="#8D6B39" text-anchor="middle">AUDIT</text>
    </g>
    ${overlayText({ text: 'Audits do not have to feel like this.' }, p)}`;
}

function sceneAuditLog(p) {
  const o = fadeForScene(p);
  const rows = ['09:02 GPS clock-in', '09:04 Care plan opened', '09:51 Signature stored', '10:00 Clock-out verified'];
  const body = rows
    .map((row, i) => {
      const reveal = ease(clamp((p - i * 0.11) / 0.3));
      return `
        <g opacity="${reveal}">
          <rect x="230" y="${154 + i * 72}" width="720" height="54" rx="18" fill="${i % 2 ? BRAND.surface : '#fff'}" stroke="${BRAND.line}" stroke-width="1.5"/>
          ${checkIcon(264, 181 + i * 72, 14)}
          <text x="302" y="${190 + i * 72}" font-family="${FONT}" font-size="25" font-weight="800" fill="${BRAND.ink}">${esc(row)}</text>
          <text x="788" y="${190 + i * 72}" font-family="${FONT}" font-size="20" font-weight="700" fill="${BRAND.muted}">verified</text>
        </g>`;
    })
    .join('');
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="180" y="105" width="920" height="440" rx="30" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="230" y="132" font-family="${FONT}" font-size="24" font-weight="850" fill="${BRAND.ink}">Audit trail</text>
      ${body}
    </g>
    ${overlayText({ text: 'Every visit. Every event. Verified.' }, p)}`;
}

function sceneComplianceSequence(p) {
  const o = fadeForScene(p);
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      ${triptychCard(95, 150, 'GPS', 'Pinned clock-in', 'Verified', BRAND.blue, clamp((p - 0.02) / 0.3))}
      ${triptychCard(460, 150, 'Exception', 'Cleared early', 'Billing protected', BRAND.attention, clamp((p - 0.22) / 0.3))}
      ${triptychCard(825, 150, 'Training', 'Auto-renewed', 'Ready', BRAND.success, clamp((p - 0.42) / 0.3))}
    </g>
    ${overlayText({ text: '21st Cures Act ready.' }, p)}`;
}

function sceneReportExport(p) {
  const o = fadeForScene(p);
  const progress = ease(clamp((p - 0.2) / 0.5));
  return `
    ${background()}
    ${footerWordmark()}
    <g opacity="${o}">
      <rect x="256" y="122" width="768" height="408" rx="30" fill="${BRAND.white}" stroke="${BRAND.line}" stroke-width="2"/>
      <text x="314" y="188" font-family="${FONT}" font-size="34" font-weight="850" fill="${BRAND.ink}">State-ready export</text>
      <rect x="314" y="238" width="540" height="24" rx="12" fill="${BRAND.softBlue}"/>
      <rect x="314" y="238" width="${540 * progress}" height="24" rx="12" fill="${BRAND.teal}"/>
      ${pill({ x: 314, y: 310, w: 220, h: 58, text: 'GPS verified', fill: '#fff' })}
      ${pill({ x: 560, y: 310, w: 220, h: 58, text: 'Signatures saved', fill: '#fff' })}
      ${pill({ x: 806, y: 310, w: 150, h: 58, text: 'Export', fill: BRAND.blue, stroke: BRAND.blue, textFill: '#fff' })}
    </g>
    ${overlayText({ text: 'Built audit-ready.' }, p)}`;
}

function sceneBumperTabs(p) {
  const o = fadeForScene(p);
  const targetX = 490;
  const tabs = [
    ['Schedule', 170, BRAND.blue],
    ['EVV', 520, BRAND.teal],
    ['Billing', 870, BRAND.success]
  ];
  const pieces = tabs.map(([label, startX, color], i) => {
    const x = startX + (targetX - startX + i * 60) * ease(p);
    const y = 300 + (i - 1) * 8 * (1 - ease(p));
    return `<g opacity="${o}">${pill({ x, y, w: 245, h: 82, text: label, fill: color, stroke: color, textFill: '#fff' })}</g>`;
  }).join('');
  return `${background()}${pieces}`;
}

function sceneBumperLine(p) {
  const o = fadeForScene(p);
  const pulse = 1 + 0.025 * Math.sin(Math.PI * clamp((p - 0.55) / 0.2));
  return `
    ${background()}
    <g transform="translate(640 335) scale(${pulse}) translate(-640 -335)" opacity="${o}">
      ${textBlock({ text: 'Care, on the same page.', x: 640, y: 350, maxWidth: 1000, size: 76, fill: BRAND.ink, weight: 850, anchor: 'middle' })}
      <rect x="486" y="388" width="308" height="10" rx="5" fill="${BRAND.teal}"/>
    </g>`;
}

function renderScene(ad, t) {
  const scene = ad.scenes.find((candidate) => t >= candidate.start && t < candidate.end) || ad.scenes.at(-1);
  const p = clamp((t - scene.start) / (scene.end - scene.start));
  switch (scene.type) {
    case 'care': return sceneCare(p);
    case 'desk': return sceneDesk(p, scene.text);
    case 'dashboard': return sceneDashboard(p, scene.text);
    case 'triptych': return sceneTriptych(p);
    case 'handoff': return sceneHandoff(p);
    case 'friday': return sceneFriday(p);
    case 'clutter': return sceneClutter(p);
    case 'ops-list': return sceneOpsList(p);
    case 'laptop-close': return sceneLaptopClose(p);
    case 'doorway': return sceneDoorway(p);
    case 'phone-clock': return scenePhoneClock(p);
    case 'phone-tasks': return scenePhoneTasks(p);
    case 'phone-verified': return scenePhoneVerified(p);
    case 'present': return scenePresent(p);
    case 'airport': return sceneAirport(p);
    case 'home-tea': return sceneHomeTea(p);
    case 'family-portal': return sceneFamilyPortal(p);
    case 'tablet-schedule': return sceneTabletSchedule(p);
    case 'audit-folder': return sceneAuditFolder(p);
    case 'audit-log': return sceneAuditLog(p);
    case 'compliance-sequence': return sceneComplianceSequence(p);
    case 'report-export': return sceneReportExport(p);
    case 'bumper-tabs': return sceneBumperTabs(p);
    case 'bumper-line': return sceneBumperLine(p);
    case 'end': return sceneEnd(scene, p);
    default: return sceneDashboard(p, scene.text || ad.title);
  }
}

function frameSvg(ad, t) {
  const body = renderScene(ad, t);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="logoIconBg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#4a9de8"/>
      <stop offset="100%" stop-color="${BRAND.blue}"/>
    </radialGradient>
    <linearGradient id="evvPill" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${BRAND.blue}"/>
      <stop offset="100%" stop-color="${BRAND.teal}"/>
    </linearGradient>
    <linearGradient id="logoText" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.ink}"/>
      <stop offset="100%" stop-color="${BRAND.blue}"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${BRAND.ink}" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${BRAND.surface}"/>
  ${body}
</svg>`;
}

async function ensureDirs() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(audioDir, { recursive: true });
  await fs.mkdir(posterDir, { recursive: true });
  await fs.mkdir(tmpDir, { recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: options.env || process.env,
    stdio: options.stdio || 'pipe',
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed\n${detail}`);
  }
  return result.stdout?.trim() || '';
}

function ffprobeDuration(filePath) {
  const output = run(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  return Number.parseFloat(output);
}

function spokenVoiceover(text) {
  return text
    .replaceAll('rayhealthevv.com', 'ray health E.V.V. dot com')
    .replaceAll("RayHealthEVV's", "Ray Health E.V.V.'s")
    .replaceAll('RayHealthEVV', 'Ray Health E.V.V.')
    .replaceAll('EVV', 'E.V.V.')
    .replaceAll('GPS', 'G.P.S.')
    .replaceAll('21st', 'twenty-first')
    .replaceAll('Cures Act', 'Cures Act')
    .replaceAll(' - ', ', ');
}

async function createVoice(ad) {
  if (!ad.voiceover) return null;
  const voicePath = path.join(audioDir, `${ad.slug}-voice.wav`);
  run('npx', ['hyperframes', 'tts', spokenVoiceover(ad.voiceover), '--voice', VOICE, '--lang', TTS_LANG, '--speed', TTS_SPEED, '--output', voicePath], {
    env: kokoroEnv
  });
  return voicePath;
}

function createBed(ad) {
  const bedPath = path.join(audioDir, `${ad.slug}-bed.wav`);
  const duration = fmt(ad.duration, 2);
  const expr = '0.035*sin(2*PI*196*t)+0.026*sin(2*PI*246.94*t)+0.018*sin(2*PI*329.63*t)+0.010*sin(2*PI*392*t)';
  run(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=${expr}:s=48000:d=${duration}`,
    '-filter:a', `afade=t=in:st=0:d=0.9,afade=t=out:st=${Math.max(0, ad.duration - 1.6)}:d=1.6`,
    '-ac', '2',
    bedPath
  ]);
  return bedPath;
}

async function createAudio(ad) {
  const bedPath = createBed(ad);
  const voicePath = await createVoice(ad);
  const outPath = path.join(audioDir, ad.audioOnly ? `${ad.slug}.mp3` : `${ad.slug}.m4a`);
  if (!voicePath) {
    run(ffmpegPath, [
      '-y',
      '-i', bedPath,
      '-t', fmt(ad.duration, 2),
      '-c:a', 'aac',
      '-b:a', '160k',
      outPath
    ]);
    return outPath;
  }

  const voiceDuration = ffprobeDuration(voicePath);
  const maxVoice = ad.duration - 0.8;
  const speed = voiceDuration > maxVoice ? clamp(voiceDuration / maxVoice, 1, 2.15) : 1;
  const voiceFilter = speed > 1.005 ? `volume=1.35,atempo=${fmt(speed, 4)},apad,atrim=0:${fmt(ad.duration, 2)}` : `volume=1.35,apad,atrim=0:${fmt(ad.duration, 2)}`;
  const codecArgs = ad.audioOnly ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : ['-c:a', 'aac', '-b:a', '192k'];
  run(ffmpegPath, [
    '-y',
    '-i', voicePath,
    '-i', bedPath,
    '-filter_complex',
    `[0:a]${voiceFilter}[vo];[1:a]volume=0.34[bed];[vo][bed]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:${fmt(ad.duration, 2)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    '-map', '[a]',
    '-t', fmt(ad.duration, 2),
    ...codecArgs,
    outPath
  ]);
  return outPath;
}

async function renderFrames(ad, frameDir) {
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });
  const totalFrames = Math.round(ad.duration * FPS);
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = frame / FPS;
    const svg = frameSvg(ad, t);
    const file = path.join(frameDir, `frame_${String(frame + 1).padStart(5, '0')}.jpg`);
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 92, chromaSubsampling: '4:2:0' })
      .toFile(file);
    if (frame === Math.floor(totalFrames * 0.52)) {
      await sharp(Buffer.from(svg))
        .jpeg({ quality: 94, chromaSubsampling: '4:2:0' })
        .toFile(path.join(posterDir, `${ad.slug}.jpg`));
    }
    if ((frame + 1) % 180 === 0) {
      process.stdout.write(`      ${frame + 1}/${totalFrames} frames\r`);
    }
  }
  process.stdout.write(`      ${totalFrames}/${totalFrames} frames\n`);
}

async function renderVideo(ad, audioPath) {
  const frameDir = path.join(tmpDir, ad.slug);
  await renderFrames(ad, frameDir);
  const output = path.join(outDir, `${ad.slug}.mp4`);
  run(ffmpegPath, [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(frameDir, 'frame_%05d.jpg'),
    '-i', audioPath,
    '-t', fmt(ad.duration, 2),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '21',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    output
  ], { stdio: 'pipe' });
  await fs.rm(frameDir, { recursive: true, force: true });
  return output;
}

async function writeManifest(outputs) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    resolution: `${W}x${H}`,
    fps: FPS,
    ttsVoice: VOICE,
    ttsLang: TTS_LANG,
    ttsSpeed: TTS_SPEED,
    canonicalUrl: 'rayhealthevv.com',
    note: 'Kokoro neural narration and generated motion graphics for review. Replace with final signed-off talent/b-roll before paid media if required.',
    outputs
  };
  await fs.writeFile(path.join(projectRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function zipOutputs() {
  const zipPath = path.join(projectRoot, 'RayHealthEVV-launch-ads-download.zip');
  await fs.rm(zipPath, { force: true });
  run('/usr/bin/zip', [
    '-r',
    zipPath,
    'renders',
    'audio/07-audio-cutdown.mp3',
    'posters',
    'manifest.json',
    'README.md'
  ], { stdio: 'pipe' });
  return zipPath;
}

async function main() {
  if (!ffmpegPath || !ffprobePath) {
    throw new Error('Missing ffmpeg-static or ffprobe-static');
  }
  await ensureDirs();
  const outputs = [];
  for (const ad of ads) {
    console.log(`\nRendering ${ad.id}: ${ad.title}`);
    const audioPath = await createAudio(ad);
    if (ad.audioOnly) {
      outputs.push({ id: ad.id, title: ad.title, type: 'audio', path: path.relative(projectRoot, audioPath), duration: ad.duration });
      continue;
    }
    const videoPath = await renderVideo(ad, audioPath);
    outputs.push({ id: ad.id, title: ad.title, type: 'video', path: path.relative(projectRoot, videoPath), duration: ad.duration });
  }
  await writeManifest(outputs);
  const zipPath = await zipOutputs();
  console.log(`\nDone. Download bundle: ${zipPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
