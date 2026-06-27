# RayHealth EVV Web — Design System Audit (01)

**Scope:** `packages/web` styling + design-token foundation
**Stack:** React 19, Tailwind CSS 4 (`@theme inline`), shadcn/ui (new-york), Radix, CVA, clsx, tailwind-merge, lucide-react, sonner, tw-animate-css
**Method:** Full read of `src/index.css` (869 lines), `components.json`, `vite.config.ts`, `package.json`, all `components/ui/*`, and a grep sweep of every feature `.tsx`.
**Status:** READ-ONLY analysis. No source modified.

---

## 0. Executive Snapshot

| Area | State | Worst severity |
|------|-------|----------------|
| Token architecture | Dual legacy-brand + shadcn-semantic, half-migrated | HIGH |
| Color system | Single-shade hex roles, no ramps, off-palette strays | HIGH |
| Dark mode | **Entirely absent** — no `.dark` block exists | CRITICAL |
| Contrast / a11y | Orange accent + muted blue text fail WCAG AA | CRITICAL |
| Typography | Fonts wired, but no scale tokens; ad-hoc sizes | MEDIUM |
| Spacing | Tailwind default scale (OK) + ad-hoc rem in legacy CSS | LOW |
| Radius | `--radius` defined but bypassed by raw + legacy values | MEDIUM |
| Shadow | No tokens; Tailwind defaults + hardcoded rgba | MEDIUM |
| Motion | No tokens; ad-hoc transitions | LOW |
| Glass | Used (backdrop-blur) but not tokenized | LOW |
| State colors (success/warn/info) | **Not tokenized** — copy-pasted emerald/amber across ~10 files | HIGH |

---

## 1. Token Architecture — the dual system

There are **two parallel token layers** living in `src/index.css`, by design (see the header comment, lines 4–13), but the migration is stalled and the two layers duplicate each other.

### Layer A — Legacy brand custom properties (`:root`, lines 46–56, 80–83)
```css
--color-primary-dark: #1248a0;
--color-primary-light: #2d7dd2;
--color-bg: #f0f4f8;
--color-surface: #ffffff;
--color-text: #1a3a5c;
--color-text-muted: #5b8fc9;
--font-heading: 'Nunito', sans-serif;
--font-body: 'DM Sans', sans-serif;
--color-primary: var(--primary);   /* alias */
--color-accent: var(--accent);     /* alias */
```
These feed **~700 lines of hand-written, non-Tailwind CSS** (lines 100–869): `.admin-shell`, `.admin-nav`, `.card`, the entire `.landing-*`, `.hero-*`, `.preview-*`, `.roadmap-*` system, plus **global bare-element selectors** `body`, `h1..h6`, and `label/input/button:not([data-slot])`.

### Layer B — shadcn semantic tokens (`:root`, lines 58–78) bridged via `@theme inline` (lines 15–43)
```css
--background:#f0f4f8; --foreground:#1a3a5c; --card:#fff; --primary:#1a5fa8;
--secondary:#e3edf7; --muted:#eef4fb; --accent:#f97316; --destructive:#dc2626;
--border:#c9d8e8; --input:#c9d8e8; --ring:#2d7dd2; --radius:0.75rem;
```
These feed Tailwind utilities (`bg-primary`, `text-muted-foreground`, …) used in all `components/ui/*` and modern feature pages.

### Migration status — quantified
Semantic tokens dominate new code, which is healthy:
- **452** semantic token utility usages (`text-muted-foreground` ×147, `text-primary` ×58, `border-border` ×52, `bg-muted` ×44 …).
- **74** raw Tailwind palette usages that bypass the system (see §2).
- **101** arbitrary-value utilities (`text-[…]`, `bg-[#…]`, `grid-cols-[…]`).

### Conflicts & duplication — **HIGH**
- **The same values are defined twice.** `--background`/`--color-bg` are both `#f0f4f8`; `--foreground`/`--color-text` diverge (`#1a3a5c` text vs `--primary #1a5fa8`) — two sources of truth for "brand blue."
- **`App.tsx:120` re-implements `.admin-nav` as an arbitrary utility** instead of using either layer:
  ```tsx
  bg-[linear-gradient(180deg,#1248a0_0%,#1a5fa8_100%)] shadow-[4px_0_15px_rgba(18,72,160,0.15)]
  ```
  This is a third copy of the nav gradient (also in `index.css:108` `.admin-nav`). The legacy `.admin-shell/.admin-nav` CSS (lines 100–158) is now **dead** if the React shell renders the nav itself — confirm and delete.
- **`components.json` says `"baseColor": "neutral"`** but the real palette is blue. Any future `npx shadcn add` will emit neutral-gray tokens that clash. **MEDIUM** — fix baseColor or commit to manual token edits.
- **Global bare-element selectors** (`label/input/button:not([data-slot])`, lines 178–219) are a fragile bridge: they style every non-shadcn element page-wide and depend on the `data-slot` opt-out. Any plain `<button>` silently becomes orange. **MEDIUM.**

---

## 2. Color System

### Palette (semantic roles, single shade each)
| Role | Hex | Notes |
|------|-----|-------|
| primary | `#1a5fa8` | brand blue |
| primary-dark | `#1248a0` | legacy only |
| primary-light / ring | `#2d7dd2` | |
| secondary | `#e3edf7` (fg `#1248a0`) | tint |
| muted | `#eef4fb` (fg `#5b8fc9`) | |
| accent | `#f97316` (orange) | **fg = white** |
| destructive | `#dc2626` | |
| background | `#f0f4f8` / foreground `#1a3a5c` | |
| border / input | `#c9d8e8` | |

There are **no color ramps** (no 50→950 scales). Every role is a single hardcoded hex, so hover/active/disabled states are faked with opacity (`hover:bg-primary/90`) and there is no principled way to derive a dark theme.

### Contrast concerns — **CRITICAL**
- **Accent orange `#f97316` with white text** (`button accent`, badges, `.evv-badge`, CTAs): white-on-`#f97316` ≈ **2.3:1**, fails WCAG AA (needs 4.5:1 for text, 3:1 for large). Used for primary CTAs and the "EVV" badge — a healthcare-compliance product should not ship failing contrast on its principal call-to-action.
- **`muted-foreground #5b8fc9` on `background #f0f4f8`** ≈ **2.5:1** — fails AA. This is the single most-used text token (147 usages) for secondary/label text.
- **`secondary-foreground #1248a0` on `secondary #e3edf7`** passes; **destructive `#dc2626` on white** passes large/normal.

### Off-palette strays — **HIGH**
- `features/learning/LearningDashboardPage.tsx:224-228` hardcodes a **completely different chart palette** (`#10A4A4` teal, `#185FA5`, `#888780`, `#BA7517`, `#E24B4A`) that exists nowhere in the token system.
- `LandingPage.tsx` carries **~10 inline hex/gradient `style={{}}`** blocks (lines 261, 309, 353, 505, 581, 589) duplicating the `.landing-*` CSS — e.g. `#083a83`, `#0f5da6`, `#062b61`, `#073f8e`, `#22c55e`. `HeroGraphic.tsx` (SVG) hardcodes 8 gradient stops (acceptable for an SVG illustration, but still off-token).
- `LandingPage.tsx:362` `bg-[#f8fbff]`, `LoginPage.tsx:39` & `AcceptInvitePage.tsx:374` repeat a 4-stop `bg-[radial-gradient(...rgba(249,115,22,0.10)...)]` auth-background literal.

### State colors NOT tokenized — **HIGH**
Success/warning/info have no tokens. The success banner literal
```
border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800
```
is **copy-pasted across ≥8 files** (`VisitCorrectionsQueuePage`, `VisitReviewPage`, `ClientsPage`, `TemplatesPage`, `AssignmentsPage`, `AcceptInvitePage`, `InsightsPanel`, …). `badge.tsx` hardcodes `success → emerald-100/emerald-800` and `warning → amber-100/amber-800`. 74 raw-palette usages are almost entirely emerald/amber/sky state colors. These must become `--success`, `--warning`, `--info` semantic roles.

### Dark mode — **CRITICAL**
There is **no `.dark` block anywhere** (`grep .dark` → 0 hits; `dark:` utilities → 0 hits). The project imports `tw-animate-css` and follows shadcn conventions that assume a `.dark` variant, but it was never authored. Dark mode is 0% complete. Any premium redesign must define the full dark token set from scratch.

---

## 3. Typography

- **Fonts wired correctly:** `index.html:9` loads `DM Sans` (300–700) + `Nunito` (300–900) from Google Fonts; `@theme` maps `--font-sans → --font-body` (DM Sans) and `--font-display → --font-heading` (Nunito). `font-display` is used 24×, `font-sans` 1×. Good.
- **No type scale tokens.** Sizing relies on Tailwind defaults: `text-sm` ×143, `text-xs` ×50, `text-base` ×11, `text-lg` ×9, `text-2xl` ×6, `text-xl` ×5, `text-5xl`/`4xl` ×4, `text-3xl` ×1. The heavy `text-sm`/`text-xs` skew suggests a cramped, label-dense UI with no deliberate hierarchy.
- **Ad-hoc arbitrary sizes** bypass the scale: `text-[0.65rem]`, `text-[0.68rem]` (`App.tsx:126,134`), `text-[2.75rem]`, `text-[0.6rem]`, `text-[0.7rem]` ×3, `text-[clamp(3rem,6.1vw,5.65rem)]` (`LandingPage`), `text-[0.65rem]` (`CopilotChatPage`). Legacy CSS adds dozens more raw rem sizes (`0.84rem`, `1.45rem`, `1.18rem`, `clamp(2.4rem,5vw,4.25rem)` …).
- **Weight sprawl:** `font-medium` ×30, `font-black` ×17, `font-semibold` ×14, `font-bold` ×12, `font-extrabold` ×3. `font-black`/`font-extrabold` (Nunito 800/900) are heavily used for a "loud" landing aesthetic — needs rationalizing to a 3–4 weight set for a professional clinical tool.

---

## 4. Spacing, Radius, Shadow, Motion, Glass

### Spacing — **LOW**
Modern components use Tailwind's default 4px-step scale (`gap-6`, `px-4`, `py-6`) consistently — effectively an 8px-ish rhythm. No custom spacing tokens, which is fine. The **legacy CSS** (lines 100–869) uses freehand rem (`2.5rem`, `1.35rem`, `0.42rem`, `clamp(3rem,8vw,6.5rem)`) with no system — but it is isolated to landing/admin and slated for replacement.

### Border-radius — **MEDIUM**
- Token base exists: `--radius:0.75rem` with derived `--radius-sm/md/lg/xl` (lines 39–42). Good foundation.
- **But usage bypasses it:** `rounded-md` ×47, `rounded-lg` ×43, `rounded-2xl` ×17, `rounded-full` ×15, `rounded-3xl` ×4, `rounded-xl` ×1, `rounded-[inherit]`. `2xl/3xl` are not derived from `--radius`, so changing the base radius won't move the big card corners. Legacy CSS hardcodes `8px`, `12px`, `16px`, `999px`, `1.25rem`, `1.5rem`, `2rem`. No single radius scale governs the app.

### Shadow — **MEDIUM**
- **No shadow tokens in `@theme`.** Components use Tailwind defaults (`shadow-xs` ×7, `shadow-sm` ×5, `shadow-md` ×5, `shadow-xl` ×4, `shadow-2xl` ×2). One arbitrary `shadow-[4px_0_15px_rgba(18,72,160,0.15)]` (`App.tsx:120`). Legacy CSS hardcodes ~15 bespoke `rgba` shadows (`0 30px 80px rgba(7,63,142,0.26)`, `0 18px 45px rgba(26,95,168,0.07)` …). No elevation system.

### Motion — **LOW**
- No motion tokens. Ad-hoc `transition-colors` ×12, `transition-all` ×2, `transition-transform` ×2, `transition-opacity` ×2, a single `duration-200`. `tw-animate-css` supplies `animate-in/animate-out` for the Radix dialog (`dialog.tsx`). No standardized duration/easing scale.

### Glass — **LOW (opportunity)**
- `backdrop-filter: blur(16px/18px)` is already used in legacy CSS (`.landing-header` line 240, `.roadmap-*` line 640) plus translucent `rgba(255,255,255,0.x)` fills. The aesthetic is present but un-tokenized and inconsistent. A premium redesign should formalize glass as named tokens.

### Inline styles — **MEDIUM**
11 `style={{}}` occurrences. Mostly `LandingPage`/`HeroGraphic` gradients (could move to CSS/tokens), plus `LearningDashboardPage` chart segment colors and `AuthContext.tsx:81` (`style={{ minHeight:'100vh', display:'flex', … }}` for a loading splash — should be a Tailwind class).

---

## 5. Inconsistencies — prioritized punch list

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | CRITICAL | No dark mode at all | no `.dark` block in `index.css`; 0 `dark:` utilities |
| 2 | CRITICAL | Accent orange + white text fails AA | `button.tsx` accent variant; `--accent #f97316`/white |
| 3 | CRITICAL | `muted-foreground #5b8fc9` on bg fails AA | `index.css:70`; 147 usages |
| 4 | HIGH | Success/warning/info not tokenized; banner literal copy-pasted | emerald-50/800 across ≥8 files; `badge.tsx` |
| 5 | HIGH | Off-palette chart colors hardcoded | `LearningDashboardPage.tsx:224-228` |
| 6 | HIGH | Dual token system duplicates values / 3 copies of nav gradient | `index.css` Layer A vs B; `App.tsx:120` |
| 7 | MEDIUM | `components.json baseColor:"neutral"` ≠ blue palette | `components.json` |
| 8 | MEDIUM | `2xl/3xl` radii not derived from `--radius` | 21 usages |
| 9 | MEDIUM | No shadow/elevation tokens | hardcoded rgba shadows in `index.css` |
| 10 | MEDIUM | Global bare-element selectors (`button:not([data-slot])`) | `index.css:178-219` |
| 11 | MEDIUM | ~10 inline gradient `style={{}}` duplicate CSS | `LandingPage.tsx` |
| 12 | LOW | ~700 lines legacy landing/admin CSS to migrate/remove | `index.css:100-869` |
| 13 | LOW | Ad-hoc `text-[…]` font sizes | `App.tsx`, `LandingPage.tsx`, `CopilotChatPage.tsx` |

---

## 6. Recommendation — target premium design system

Direction: a **calm, high-trust clinical aesthetic** — deep medical blue as the brand spine, a restrained teal/cyan secondary for "data/insight," a *demoted* warm accent used sparingly (never as load-bearing CTA text color), full semantic state ramps, and a complete light **and** dark theme. Below is a concrete target `@theme` / token structure.

### 6.1 Color ramps (define raw scales once, 50→950)
Author OKLCH ramps (Tailwind 4 native) so dark mode and hover states derive mathematically instead of by opacity hacks.
```css
@theme {
  /* Brand blue — anchor #1a5fa8 ≈ 600 */
  --color-brand-50:  oklch(0.97 0.02 250);
  --color-brand-100: oklch(0.93 0.04 250);
  --color-brand-200: oklch(0.87 0.07 250);
  --color-brand-300: oklch(0.78 0.10 250);
  --color-brand-400: oklch(0.66 0.13 250);
  --color-brand-500: oklch(0.55 0.15 250);
  --color-brand-600: oklch(0.47 0.15 250);  /* primary */
  --color-brand-700: oklch(0.40 0.14 250);
  --color-brand-800: oklch(0.33 0.11 250);
  --color-brand-900: oklch(0.26 0.08 250);
  --color-brand-950: oklch(0.18 0.05 250);

  /* Teal "insight/data" secondary — replaces stray #10A4A4 */
  --color-teal-50 … --color-teal-950;   /* hue ~195 */

  /* Warm accent — DEMOTED. Reserve for highlights/illustration, not CTA text. */
  --color-amber-50 … --color-amber-950;  /* hue ~70, the orange family */

  /* Neutrals — cool slate ramp (matches #f0f4f8 / #1a3a5c family) */
  --color-slate-50 … --color-slate-950;

  /* State ramps */
  --color-success-50 … 950;  /* emerald, hue ~155 */
  --color-warning-50 … 950;  /* amber,   hue ~70  */
  --color-danger-50  … 950;  /* red,     hue ~25  */
  --color-info-50    … 950;  /* sky,     hue ~230 */
}
```

### 6.2 Semantic roles (light + dark) — `@theme inline` mapping to the ramps
Define every role for both themes; pick shades that **pass AA** (body text ≥4.5:1, large/UI ≥3:1).
```css
:root {
  --background: var(--color-slate-50);
  --foreground: var(--color-slate-900);
  --card: #ffffff;            --card-foreground: var(--color-slate-900);
  --popover: #ffffff;         --popover-foreground: var(--color-slate-900);
  --primary: var(--color-brand-600);      --primary-foreground: #ffffff;     /* white on 600 ≈ 5:1 ✓ */
  --secondary: var(--color-teal-100);     --secondary-foreground: var(--color-teal-800);
  --muted: var(--color-slate-100);        --muted-foreground: var(--color-slate-600);  /* fixes the 2.5:1 failure */
  --accent: var(--color-amber-500);       --accent-foreground: var(--color-slate-900); /* dark text, never white */
  --success: var(--color-success-600);    --success-foreground: #ffffff;
  --success-subtle: var(--color-success-50); --success-subtle-foreground: var(--color-success-800);
  --warning / --warning-subtle / --info / --info-subtle: …  /* same subtle/solid pattern */
  --destructive: var(--color-danger-600); --destructive-foreground: #ffffff;
  --border: var(--color-slate-200);  --input: var(--color-slate-200);  --ring: var(--color-brand-500);
}
.dark {
  --background: var(--color-slate-950);
  --foreground: var(--color-slate-100);
  --card: var(--color-slate-900);         --card-foreground: var(--color-slate-100);
  --primary: var(--color-brand-400);      --primary-foreground: var(--color-slate-950);
  --muted: var(--color-slate-800);        --muted-foreground: var(--color-slate-400);
  --border: var(--color-slate-800);  --input: var(--color-slate-800);  --ring: var(--color-brand-400);
  /* …complete the full role set… */
}
```
This single change retires the success-banner copy-paste (use `bg-success-subtle text-success-subtle-foreground`), the `badge.tsx` hardcodes, and the off-palette chart colors (chart series = `brand-500 / teal-500 / success-500 / warning-500 / danger-500 / slate-400`).

### 6.3 Typography scale (define, then forbid `text-[…]`)
```css
@theme {
  --font-display: 'Nunito', sans-serif;   /* keep, but cap weights at 600/700/800 */
  --font-sans:    'DM Sans', sans-serif;
  --text-xs:  0.75rem;  --text-xs--line-height: 1.0rem;
  --text-sm:  0.875rem; --text-sm--line-height: 1.25rem;
  --text-base:1rem;     --text-base--line-height: 1.5rem;
  --text-lg:  1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem;
  --text-3xl: 1.875rem; --text-4xl: 2.25rem; --text-5xl: 3rem;
  /* display sizes for marketing use clamp() but as named tokens, not inline */
}
```
Map 7 roles in docs: `display`, `h1–h4`, `body`, `body-sm`, `caption/label`. Eliminate `text-[0.65rem]`/`text-[0.68rem]` (→ `text-xs`).

### 6.4 Radius — one scale, everything derives
```css
@theme {
  --radius: 0.625rem;                       /* slightly tighter = more clinical */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);  /* add so big cards track the base */
  --radius-3xl: calc(var(--radius) + 16px);
}
```

### 6.5 Shadow / elevation tokens (light + dark)
```css
@theme {
  --shadow-xs: 0 1px 2px oklch(0.47 0.15 250 / 0.06);
  --shadow-sm: 0 1px 3px oklch(0.47 0.15 250 / 0.08), 0 1px 2px oklch(0.47 0.15 250 / 0.06);
  --shadow-md: 0 4px 12px oklch(0.47 0.15 250 / 0.08);
  --shadow-lg: 0 12px 28px oklch(0.47 0.15 250 / 0.10);
  --shadow-xl: 0 24px 60px oklch(0.47 0.15 250 / 0.12);
  --shadow-glow: 0 0 0 1px var(--ring), 0 0 24px oklch(0.55 0.15 250 / 0.25); /* focus/active */
}
```
Tinted with the brand hue (not neutral black) for cohesion; dark theme uses higher-alpha black shadows.

### 6.6 Motion tokens
```css
@theme {
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.3, 0, 0, 1);
  --duration-fast: 120ms; --duration-base: 200ms; --duration-slow: 320ms;
}
```
Pair with `tw-animate-css`; respect `prefers-reduced-motion`.

### 6.7 Glass tokens (premium surfaces)
```css
@theme {
  --glass-bg: oklch(1 0 0 / 0.72);          --glass-bg-dark: oklch(0.20 0.03 250 / 0.55);
  --glass-border: oklch(1 0 0 / 0.18);
  --glass-blur: 16px;                        --glass-blur-strong: 24px;
  --glass-shadow: 0 12px 35px oklch(0.47 0.15 250 / 0.10);
}
```
Use for the sticky header, command palettes, modals, and the marketing preview cards (replacing the inline `rgba`/`backdrop-filter` literals).

### 6.8 Migration sequencing
1. **Add `.dark` + state/success tokens first** (unblocks #1, #2, #3, #4 — highest user-facing value).
2. Fix `--muted-foreground` and demote accent (accessibility quick win, no markup churn).
3. Replace the 8× emerald banner + `badge.tsx` + chart hexes with `success/warning/info` roles.
4. Set `components.json baseColor` to a custom/blue base and document that tokens are hand-authored.
5. Port `.landing-*`/`.admin-*` legacy CSS (lines 100–869) to token-driven Tailwind components, then delete; remove the global `:not([data-slot])` element selectors.
6. Lint-gate `text-[…]`, `bg-[#…]`, and raw palette utilities (`bg-emerald-50` etc.) to prevent regression.

---

### Key file references
- `packages/web/src/index.css:15-43` — `@theme inline` bridge
- `packages/web/src/index.css:45-83` — dual `:root` token definitions
- `packages/web/src/index.css:100-869` — legacy non-Tailwind CSS to migrate
- `packages/web/components.json` — `baseColor:"neutral"` mismatch
- `packages/web/src/components/ui/button.tsx`, `badge.tsx` — accent/state hardcodes
- `packages/web/src/App.tsx:120` — nav gradient as arbitrary utility (3rd copy)
- `packages/web/src/features/learning/LearningDashboardPage.tsx:224-228` — off-palette chart hexes
- `packages/web/src/features/landing/LandingPage.tsx` — inline gradient `style={{}}` duplication
