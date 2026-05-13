# Gemini Prompt — Auto-customize the Legal Templates

Copy everything below the line into a new chat with Gemini (or Claude / ChatGPT). Then paste your agency information, brochure text, website URL, or business card photo when asked. Gemini will respond with a complete `agency-info.json` you can save back into this folder.

---

You are helping me populate `agency-info.json` for a homecare agency's legal document templates. The JSON's keys are placeholders that will be string-replaced into 25 legal/HR templates (HIPAA notices, service agreements, employment applications, state-specific addenda for Pennsylvania and Ohio, etc.).

**Your task**: Ask me clarifying questions one round at a time, then output a single fenced ```json``` block I can save as `agency-info.json`.

**Required fields** — these MUST be filled correctly or the documents will be wrong. Do not guess; ask:

- `AGENCY_NAME` — full legal entity name (e.g., "Acme Homecare, LLC")
- `AGENCY_ADDRESS`, `AGENCY_CITY`, `AGENCY_STATE`, `AGENCY_ZIP`, `AGENCY_COUNTY`
- `AGENCY_PHONE`, `AGENCY_EMAIL`
- `AGENCY_LICENSE_NUMBER` — state homecare license / certificate number
- `PRIVACY_OFFICER_NAME`, `PRIVACY_OFFICER_EMAIL` — HIPAA privacy contact
- `COMPLIANCE_OFFICER_NAME`, `COMPLIANCE_OFFICER_EMAIL` — complaints contact
- `EFFECTIVE_DATE` — date this version of the docs takes effect

**State-specific** — fill the one that applies, leave the other as the default placeholder text:

- `PA_HOMECARE_LICENSE` — PA Department of Health license number (PA only)
- `OH_PROVIDER_NUMBER` — Ohio Medicaid / ODH provider number (OH only)
- `OH_BWC_POLICY` — Ohio Bureau of Workers' Compensation policy number (OH only)
- `WC_CARRIER`, `WC_CONTACT` — workers' comp carrier (any state)

**Rate schedule** — I'll tell you these or ask my pricing director:

- `HOURLY_RATE`, `WEEKEND_RATE`, `HOLIDAY_RATE`, `OVERNIGHT_RATE`, `LIVE_IN_RATE`
- `MIN_VISIT_HOURS` (typically 2–4)
- `MILEAGE_RATE` (current IRS standard mileage rate is a good default)

**HR / hiring fields** — sensible defaults are OK if I don't have specifics:

- `PAY_SCHEDULE` — e.g., "bi-weekly, every other Friday"
- `BENEFITS_SUMMARY`, `PTO_SUMMARY` — short prose
- `E_VERIFY_STATUS` — must be `"is"` or `"is not"` (we use it in a sentence: "Agency {{E_VERIFY_STATUS}} an E-Verify employer")
- `I9_RETENTION_TEXT` — the standard answer is `"3 years after date of hire OR 1 year after termination, whichever is later"`

**Sensible defaults** — fill these unless I tell you otherwise:

- `BILLING_FREQUENCY`: "weekly"
- `PAYMENT_TERMS_DAYS`: "15"
- `PAYMENT_METHODS`: "check, ACH, credit card"
- `RETURNED_PAYMENT_FEE`: "35"
- `LATE_FEE_PCT`: "1.5"
- `LATE_THRESHOLD_DAYS`: "30"
- `CANCEL_NOTICE_HOURS`: "24"
- `TERMINATION_NOTICE_DAYS`: "14"
- `NONPAYMENT_THRESHOLD_DAYS`: "30"
- `GRIEVANCE_ACK_DAYS`: "3"
- `GRIEVANCE_RESOLVE_DAYS`: "10"
- `NDA_SURVIVAL_YEARS`: "3"
- `AUTHORIZATION_EXPIRATION_DATE`: "one (1) year from signing"

**Per-client / per-employee fields** — these vary every time the doc is used, so leave them as blank lines so the recipient can hand-write or e-sign at the time of signing:

- `CLIENT_NAME`, `CLIENT_ADDRESS`, `CLIENT_DOB`
- `CANDIDATE_NAME`, `CANDIDATE_FIRST_NAME`, `CANDIDATE_ADDRESS`
- `EMPLOYEE_NAME`
- `OFFER_DATE`, `OFFER_EXPIRATION_DATE`, `START_DATE`, `TRAINING_DATE`
- `SUPERVISOR_NAME`, `HIRING_MANAGER_NAME`

For all of these, use the literal value `"_______________________"` so a printed line shows up.

**State regulator phone numbers** — if I'm in PA or OH, prefill:

- PA: `STATE_REGULATOR_NAME` = "Pennsylvania Department of Health, Division of Home Health", `STATE_REGULATOR_PHONE` = "1-800-254-5164", `APS_PHONE` = "1-800-490-8505", `CPS_PHONE` = "1-800-932-0313", `OMBUDSMAN_PHONE` = "1-717-783-8975"
- OH: `STATE_REGULATOR_NAME` = "Ohio Department of Health", `STATE_REGULATOR_PHONE` = "1-800-342-0553", `APS_PHONE` = "1-855-644-6277", `CPS_PHONE` = "1-855-642-4453", `OMBUDSMAN_PHONE` = "1-800-282-1206"

---

**Output format** — when I've answered your questions, respond with exactly:

1. A fenced ```json``` block containing the complete object (every key from the schema above)
2. A short list of any fields you had to guess or that I should double-check before relying on
3. Nothing else

Use double quotes throughout. Do not include trailing commas. Do not include the leading `_comment` field — I'll add it back if I want.

Now, ask me your first round of questions.
