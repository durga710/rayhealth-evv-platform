# Gemini-assisted fill: agency-info.json

Open Gemini (`gemini.google.com`), attach a screenshot of your agency's website, your brochure / one-pager, your latest invoice, your business license, or your insurance certificate (anything you have — Gemini will use whatever it can read), then paste the prompt below verbatim.

Gemini will return a single JSON block. Save that block as `agency-info.json` next to this file, then run `python scripts/customize.py`.

---

## Copy/paste prompt

> You are filling in a JSON configuration file for a homecare agency that is licensing a legal-template package. I'm attaching one or more documents (brochure, website screenshot, license, insurance certificate, invoice). Your job is to extract the agency's information and emit ONE valid JSON object — nothing else, no commentary, no markdown fences.
>
> The exact schema (every key is required, all values are strings):
>
> ```
> {
>   "AGENCY_SLUG": "kebab-cased agency name, e.g. acme-homecare",
>
>   "AGENCY_NAME": "",
>   "AGENCY_LEGAL_ENTITY_TYPE": "LLC | Inc. | Corp. | LP | sole proprietorship",
>   "AGENCY_ADDRESS_LINE_1": "",
>   "AGENCY_ADDRESS_LINE_2": "",
>   "AGENCY_CITY": "",
>   "AGENCY_STATE": "two-letter postal code, e.g. PA or OH",
>   "AGENCY_ZIP": "",
>   "AGENCY_PHONE": "",
>   "AGENCY_FAX": "",
>   "AGENCY_EMAIL": "",
>   "AGENCY_WEBSITE": "",
>
>   "AGENCY_LICENSE_NUMBER": "",
>   "AGENCY_LICENSE_STATE": "two-letter postal code",
>   "AGENCY_TAX_ID_EIN": "##-#######",
>
>   "PRIVACY_OFFICER_NAME": "",
>   "PRIVACY_OFFICER_EMAIL": "",
>   "PRIVACY_OFFICER_PHONE": "",
>
>   "COMPLIANCE_OFFICER_NAME": "",
>   "COMPLIANCE_OFFICER_EMAIL": "",
>
>   "HR_CONTACT_NAME": "",
>   "HR_CONTACT_EMAIL": "",
>
>   "HOURLY_RATE": "$ per hour, e.g. $28.00",
>   "OVERTIME_RATE": "",
>   "HOLIDAY_RATE": "",
>   "MILEAGE_RATE": "$ per mile, e.g. $0.67",
>   "MINIMUM_VISIT_HOURS": "integer or decimal as a string",
>
>   "LATE_PAYMENT_FEE_PCT": "decimal as a string, e.g. 1.5",
>   "INVOICE_FREQUENCY": "weekly | bi-weekly | monthly",
>   "PAYMENT_DUE_DAYS": "integer as string",
>
>   "EFFECTIVE_DATE": "human-readable date, e.g. January 1, 2026",
>   "NOTICE_PERIOD_DAYS": "integer as string",
>
>   "STATE_REGULATOR_NAME": "",
>   "STATE_REGULATOR_PHONE": "",
>   "STATE_REGULATOR_WEBSITE": "",
>
>   "APS_PHONE": "Adult Protective Services hotline for the agency's state",
>   "APS_WEBSITE": "",
>
>   "PA_HOMECARE_LICENSE": "PA Department of Health home care license number, or the empty string if not applicable",
>   "PA_DEPT_HEALTH_PHONE": "1-877-724-3258 if PA, else empty",
>
>   "OH_PROVIDER_NUMBER": "Ohio provider number, or the empty string if not applicable",
>   "OH_DEPT_HEALTH_PHONE": "1-614-466-3543 if OH, else empty",
>
>   "INSURANCE_LIABILITY_LIMIT": "general liability limits, e.g. $1,000,000 per occurrence / $3,000,000 aggregate",
>   "INSURANCE_AUTO_LIMIT": "non-owned auto limits, e.g. $100,000 / $300,000 / $50,000",
>   "WORKERS_COMP_CARRIER": ""
> }
> ```
>
> Rules:
>
> 1. Extract everything you can directly read from the attachments. Do NOT invent agency-specific facts.
> 2. If a field is not visible in the attachments, use a reasonable default for the agency's apparent state. Pennsylvania defaults: STATE_REGULATOR_NAME = "Pennsylvania Department of Health, Division of Home Health"; STATE_REGULATOR_PHONE = "1-800-254-5164"; STATE_REGULATOR_WEBSITE = "https://www.health.pa.gov"; APS_PHONE = "1-800-490-8505"; APS_WEBSITE = "https://www.aging.pa.gov"; PA_DEPT_HEALTH_PHONE = "1-877-724-3258"; OH_PROVIDER_NUMBER = ""; OH_DEPT_HEALTH_PHONE = "". Ohio defaults are the mirror image.
> 3. If a field cannot be filled from the attachments and there is no sensible state default (license number, EIN, officer names, rates), set it to the empty string `""` so the agency can fill it manually.
> 4. AGENCY_SLUG must be lowercase kebab-case derived from AGENCY_NAME (strip "LLC", "Inc.", punctuation; replace spaces with single hyphens).
> 5. AGENCY_LEGAL_ENTITY_TYPE must match what appears in the agency's name (e.g. "ABC Home Care, LLC" -> "LLC").
> 6. Money values keep their currency symbol and formatting (e.g. `$28.00`, not `28`).
> 7. EFFECTIVE_DATE should default to "the first day of next month, written long-form" if not given (e.g. "June 1, 2026").
> 8. Output ONLY the JSON object. No prose before or after. No code fences.

---

## After Gemini responds

1. Copy the JSON block from Gemini's reply.
2. Save it as `agency-info.json` in this directory (overwriting the example).
3. Spot-check it (license number, phone, address — these are the fields agencies most often have wrong).
4. Run `/tmp/legal-templates-venv/bin/python scripts/customize.py`.
5. Open `customized/<your-slug>/docx/` and review every document with your attorney before signing anything.
