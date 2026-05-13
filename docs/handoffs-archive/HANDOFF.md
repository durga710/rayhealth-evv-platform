# Legal Templates — Handoff for Codex / Next Engineer

This doc describes what was shipped, where it lives, and what's still TODO. If you're picking this up to extend it, start here.

---

## What was shipped

A complete library of customizable homecare-agency legal/HR templates, integrated into the public website as a Resources page.

### Source / authoring

- `resources/legal-templates/scripts/generate_docs.py` — single source of truth for all 25 templates. Each template is a Python function that uses `python-docx` to emit a styled `.docx` with `{{PLACEHOLDER}}` merge fields. To change wording, edit this script and rerun it.
- `resources/legal-templates/scripts/customize.py` — reads `agency-info.json` and produces a per-agency `customized/<slug>/{docx,pdf}/` folder by find-replacing every placeholder and re-rendering to PDF via `libreoffice --headless`.
- `resources/legal-templates/agency-info.json` — example config; one key per placeholder. Agency edits this (or hands it to Gemini via `GEMINI_PROMPT.md`).
- `resources/legal-templates/README.md` — agency-facing documentation.
- `resources/legal-templates/GEMINI_PROMPT.md` — copy-paste prompt that makes any LLM produce the agency's `agency-info.json`.

### Generated assets

Inside `resources/legal-templates/`:

| Folder | Count | Description |
|---|---|---|
| `client-onboarding/docx/` and `/pdf/` | 10 + 10 | Master client onboarding pack |
| `hiring/docx/` and `/pdf/` | 13 + 13 | Master hiring/HR pack |
| `state-addenda/docx/` and `/pdf/` | 2 + 2 | PA + OH state-specific addenda |

Total: 25 master `.docx` files and 25 master `.pdf` files. Sizes: ~6.7 MB.

### Web integration

The masters are mirrored into `packages/web/public/legal-templates/` so Vite serves them as static assets.

| URL | Renders |
|---|---|
| `/resources/legal-templates` | `LegalResourcesPage.tsx` — searchable, filterable browse of all 25 templates with PDF + DOCX download buttons |
| `/resources` and `/legal-templates` | Redirect to `/resources/legal-templates` |
| `/legal-templates/<folder>/pdf/<name>.pdf` | Static PDF download |
| `/legal-templates/<folder>/docx/<name>.docx` | Static DOCX download |
| `/legal-templates/README.md`, `/legal-templates/GEMINI_PROMPT.md`, `/legal-templates/agency-info.example.json` | Helper docs |

Files touched in `packages/web/`:

- `src/app/pages/LegalResourcesPage.tsx` — new page, ~250 lines, uses Tailwind + Lucide consistent with `DocumentationPage.tsx`.
- `src/app/pages/index.ts` — added `export * from './LegalResourcesPage';`.
- `src/App.tsx` — added import + 3 routes (canonical, two redirects).
- `public/legal-templates/` — 103 static files (PDFs, DOCX, MD, JSON).

---

## What's intentionally NOT done yet (your backlog)

These are the natural next steps, in priority order. Each one is small enough to ship as its own PR.

### 1. Per-agency dynamic customization API (highest value)

Right now agencies download generic templates and run `customize.py` themselves (or do find-replace in Word). This is fine for v0 but the obvious next step is to do the customization on the server using the agency profile that's already in the database.

Suggested architecture:

- Add a new vertical: `verticals/legal-resources/` matching the existing service/repository pattern.
- `service.ts` exposes:
  - `listTemplates()` — returns the catalog (id, title, blurb, category)
  - `renderTemplate(templateId, agencyId, options?)` — produces a customized PDF/DOCX stream
- `routes.ts`:
  - `GET /api/legal-resources/templates` — list
  - `GET /api/legal-resources/templates/:id/pdf?agencyId=…` — streams the customized PDF
  - `GET /api/legal-resources/templates/:id/docx?agencyId=…` — streams the customized DOCX
- The render path can shell out to the existing Python `customize.py` (cleanest), or port the find-replace into Node. If you port to Node, use `docxtemplater` for the .docx side and either `docx-pdf` or run LibreOffice via `libreoffice-convert` for the PDF.
- Cache rendered PDFs in S3 keyed on `(templateId, agencyProfileHash)`. Invalidate when the agency profile changes.
- The placeholder list is the keys of `agency-info.json`. That maps roughly 1:1 to fields on the `organizations` table — extend the org schema as needed (license number, privacy officer, rate schedule, etc.).
- Gate behind a `legal-resources:read` permission (existing `PermissionService`).

### 2. Wire into the admin dashboard

- Add a "Resources" or "Legal Templates" tab in `packages/web/src/app/pages/admin/`. List the same catalog, but each download button hits the new authenticated endpoint and gets the customized version (no manual `customize.py` step needed).
- Add an "Edit agency profile" form so the admin can fill in the placeholder values once. The web frontend can call `agency-info.json`-shaped fields against the org record.

### 3. E-signature integration

- Connect to DocuSign or HelloSign. When the office sends a packet to a new client/employee, the customized PDF goes through the e-sign flow.
- Persist signed copies in object storage; index in a new `signed_documents` table with `client_id`/`caregiver_id` FK.
- Audit trail: existing `audit_logs` table can capture send/sign/decline events.

### 4. State coverage beyond PA + OH

The two state addenda use the same content scaffold. To add a state, add a new `doc_<xx>_addendum` function in `generate_docs.py` patterned on the existing two, then add it to `STATE_DOCS`. Every state's addendum should cover:

- Licensure / certification (which agency, license #)
- Background check requirements (state and federal, registry checks)
- Mandatory reporting hotlines (APS, CPS, state DOH, ombudsman)
- Training / competency rules
- Wage-hour specifics
- Workers' comp specifics
- Any state-specific patient-rights language

Priorities to add next: TX, CA, NY, FL, NJ, IL.

### 5. Versioning and audit

- Stamp every generated PDF with a footer: `Template version vX.Y · {{AGENCY_NAME}} · Effective {{EFFECTIVE_DATE}}`.
- Bump a version key in `generate_docs.py` whenever wording changes; persist (template_id, version, agency_id, rendered_at) into a new `legal_template_renders` table for compliance.

### 6. HIPAA training delivery (not just acknowledgment)

The hiring pack includes the *acknowledgment* of HIPAA training, but the agency still needs to deliver the training. We could ship a built-in training module + quiz that flows into the acknowledgment doc. This is its own project; punt unless a customer asks.

### 7. Federal forms

I-9 and W-4 are intentionally **not** included — using outdated versions is itself a violation. The hiring pack ships a "I-9 / W-4 Cover Sheet" that points the new hire to `uscis.gov` and `irs.gov`. Long-term we should:

- Detect the current version automatically (USCIS publishes the version on the form).
- Use a fillable PDF service (DocuSeal, Anvil) for the actual federal forms.
- Don't try to hand-build copies.

### 8. Mobile app surface

- The mobile app (`packages/mobile`) doesn't surface these templates yet. Caregivers don't typically need them, but admins on mobile do. Same `/api/legal-resources` endpoints can power a mobile screen.

---

## How to run / verify locally

```bash
# Regenerate the master templates (after editing generate_docs.py):
cd resources/legal-templates
python3 scripts/generate_docs.py
for f in client-onboarding/docx/*.docx hiring/docx/*.docx state-addenda/docx/*.docx; do
  outdir="$(dirname "$f" | sed 's|/docx$|/pdf|')"
  libreoffice --headless --convert-to pdf --outdir "$outdir" "$f"
done

# Mirror into the web public folder so the Resources page sees them:
cp -r client-onboarding hiring state-addenda README.md GEMINI_PROMPT.md \
  ../../packages/web/public/legal-templates/

# Run the web dev server:
cd ../..
npm run dev --filter=@rayhealth-evv/web
# Open http://localhost:5173/resources/legal-templates
```

---

## Disclaimers (preserve when communicating with users)

- These are starting templates, not legal advice.
- A homecare-experienced attorney licensed in each operating state must review before deployment.
- Citations in the PA and OH addenda were correct at publication; re-validate annually.
- Federal forms (I-9, W-4) must be downloaded directly from USCIS / IRS — do not redistribute.

---

## Contact

When in doubt, the source-of-truth doc for users is `resources/legal-templates/README.md`. The Python generator and customizer scripts are heavily commented; start there if changing wording or adding a state.
