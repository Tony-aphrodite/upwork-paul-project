# Ageing Navigator pilot: implementation plan

Written 2026-09-30, at the end of day one. Read it with `HANDOFF.md` (scope, terms, client) and `WORKLOG.md` (hours
and day plan). The hours below are the 56-hour plan, line by line. Line 0 (4 h) and 2 hours of line 1 are done.

## 0. Build status (2026-10-01)

The code is in `demo/` of this repository, with its history; the prototype is tag `prototype-2026-09-23`.
Push only with the user's approval.

**Verification:**
- 91 tests pass on PGlite, with Chrome for the PDFs.
- The same suites pass on a real PostgreSQL 16 through the production driver (`TEST_DATABASE_URL`): 84 passed,
  and the 7 PDF tests were skipped because Chrome was not set for that run.
- `tsc` is clean and `next build` passes.
- A full browser run on a local production server passed at desktop and 390 px:
  - the flow: questionnaire, resume, submit, setup link, review, edit, preview, release, family page, PDF,
    help request, feedback, CSV;
  - no sideways scroll;
  - the only console error is the deliberate wrong-password test.

### Code review, 2026-10-01

Four independent reviews looked at the frontend, the backend and security, the database, and the engine against the
requirements. They found about 50 issues. The important ones, all fixed and each covered by a test:

| Area | Found | Fixed |
| --- | --- | --- |
| Database | Every jsonb value was stored as a JSON string by postgres.js; tests on PGlite could not see it | JSON only through `jsonb()`; test asserts `jsonb_typeof = object` on real Postgres |
| Engine | "Not sure" to the urgent question with a concern named was not urgent | Urgent when `q18 in yes, possibly or q18a answered` |
| Security | A new setup link re-enabled the old password and sessions; anyone could lock a navigator out | Reset ends password and sessions; only failures count, per connection and per account |
| Submission | A dropped response made families submit twice | `submission_id`: the second submission finds the first case |
| Retention | A case in review could be deleted after 60 days; the purge could race a release | Date extends while worked on; one-statement purge |
| Review screen | Typing during a save was marked as saved; close/regenerate could lose edits | Revision check; actions wait for a save; no reloads |
| Questionnaire | "Continue where you left off" restarted; no focus management | Resumes at the section reached; focus to each heading and first problem |
| Content import | "Asked later" used the wrong order; wrong row numbers; unchecked placeholders | Section order; real sheet rows; per-text placeholder rules |
| Structure | The pilot reached into prototype modules; the old questionnaire was still exported as `questionnaire` | Prototype removed (kept at the tag); shared `rules/`, `priority.ts`, `text.ts`, `route.ts`, `validate.ts` |

**Left open on purpose:**
- **Private link in the URL.** It can appear in Vercel's request logs. This is normal for emailed links, and no
  other party sees it.
- **Distributed guessing.** An attack from many connections can still lock one account for 15 minutes, after 50
  failures.
- **CSP allows inline scripts.** Next.js hydration needs them. A nonce-based CSP can come in the full build.
- **Browser checks not done yet.** There has been no manual keyboard-only pass, and no check in Safari or Firefox.
  Do both before go-live.

**Content points for the client** (his wording and his decisions, not code):
- **Duplicate questions:** q19_level repeats rc2, and q6_owns repeats f2. Either can be dropped.
- **Unused questions:** 30 questions feed no rule yet, among them the finance questions, the village questions and
  the free-text region. Either keep them for the navigator to read, or drop them to collect less.
- **Consent wording:** the draft consent states 12 months' retention and storage in Australia. He must confirm both.
- **Legal and clinical statements:** the Occupation Right Agreement legal-advice requirement and the EPOA capacity
  point need his confirmation, and 11 draft actions have no source.
- **URGENT subject line:** navigator emails can say "URGENT". Check that he accepts this.
- **Regenerate from answers:** this navigator tool rebuilds a plan after a content update. It is not the family-facing
  "plan regeneration" his scope leaves out; tell him.

| Step | Status |
| --- | --- |
| 1b, 1c, 1d | Done |
| 1e | Staging done (2026-10-02): https://ageing-navigator-pilot.vercel.app on the client's Supabase project (Sydney, PostgreSQL 17), functions in `syd1`, framework set to Next.js in `vercel.json`. **Waiting:** `RESEND_API_KEY` and `EMAIL_FROM` once his domain is verified in Resend |
| 2a to 2d | Done. The first screen and the "not sure" route use draft content until his arrives |
| 2e | Mobile checked at 390 px; focus and Enter handling done. A manual keyboard-only pass is still to do |
| 3a | Done: `deliverables/Ageing-Navigator-content-spreadsheet.xlsx`. Section 15 went out without it; the section 18 reply attaches it |
| 3b, 3c | Done |
| 3d | **Waiting:** his completed spreadsheet |
| 4a to 4e | Done |
| 5a, 5c, 5d | Done |
| 5b | Layout done with placeholder branding (`src/lib/brand.ts`). **Waiting:** his logo, colours and any template sample |
| 6a, 6b | Done. The email is tested through a stand-in transport; real sending needs the Resend key. Until then the review screen says "Email is not set up yet" and shows the link to copy |
| 6c | 2026-10-02: ageingnavigator.com added in his Resend account (Tokyo, tracking off), `plan.ageingnavigator.com` added to the Vercel project, `EMAIL_FROM` and `EMAIL_REPLY_TO` set. **Waiting:** Paul adds the four records (`chatting.md` section 20); then the Resend key (entered by the user), `APP_URL`, redeploy, email test |
| 7a to 7c | Done |
| 8a, 8b | Done; the access checklist is in `demo/README.md` |
| 8c | **Waiting:** a paid database tier for daily backups, then one restore test |
| 8d | The facts are in the README privacy section. The client-facing facts sheet is still to write |
| 9a, 9b | Done: `npm run seed:fictional`, and the browser run, locally and on staging (2026-10-02: no problems at desktop and 390 px; PDF built in Sydney) |
| 9c, 9d | Staging ready, with seven fictional families waiting for review and two released. Paul's navigator account exists; his setup link goes in the section 19 message. **Waiting:** his run, then go-live |
| 10 | README written. The client handover note comes at the end |
| 11 (additions) | Done: new-submission email (urgent marked), referral source, feedback, CSV export |

**Before any real family:**
- Repeat the browser run on staging against Supabase. Done 2026-10-02.
- Delete the fictional cases and the disabled account `staging-check@example.test` before real families use this database.
- Set `REQUIRE_APPROVED_CONTENT=1` on production.

## 1. Where we start

The prototype in `demo/` (commit `3455f32`) already has most of the engine the pilot needs:
- a conditional questionnaire held as content;
- a rules engine with a safe condition language;
- a plan template that leaves out empty sections;
- tested PDF generation on Vercel;
- a signed-cookie sign-in.

What stops it from being used with real families:

| Gap | Where in the code | Line |
| --- | --- | --- |
| Answers never leave the family's browser (`localStorage`); no database | `src/lib/workspace.ts`, `src/app/questionnaire/QuestionnaireForm.tsx` | 1, 2 |
| One shared demo password, printed on `/login`; in-memory rate limit that does not survive serverless restarts | `src/lib/auth.ts`, `src/app/api/auth/login/route.ts` | 1, 8 |
| The family sees the plan straight after the questionnaire, before any review | `src/app/questionnaire/PlanResult.tsx` | 2, 6 |
| Rules read a hand-written family profile, so every change to the questions needs code in `map.ts` (237 lines) | `src/lib/questionnaire/map.ts`, `content/modules.json` | 3 |
| Our placeholder wording, branding and fictional providers | `content/*.json`, `src/doc/templates.ts` | 3, 5 |
| Review can change status, owner and notes, but not wording, and cannot remove an action | `src/app/admin/plans/[planId]/ActionsTab.tsx` | 4 |
| No release, private link, email, implementation request, consent, retention, deletion or backups | none | 2, 6, 7, 8 |
| Out-of-scope screens: test console, repository, modules, docs, versioning, matching | `src/app/admin/*`, `src/app/docs` | 1 |

## 2. Design decisions

Each one is chosen to keep the pilot within its hours and to leave the full build something to add to, not undo.

1. **The prototype is kept, the pilot is a branch.** Tag the current state `prototype-2026-09-23`, then work on a
   `pilot` branch. Out-of-scope routes are deleted from the pilot branch. Library code such as matching and
   versioning stays in `src/lib`, unused, because the full build needs it. The prototype is always recoverable from
   the tag.
2. **Rules read the answers directly, by question ID.** The pilot engine evaluates conditions against
   `{ answers, derived }` instead of the hand-mapped `FamilyProfile`. His spreadsheet can then say
   `q8 has memory_or_thinking`, and changing a question is a content change, not a code change. This reuses
   `test()` from `src/lib/engine/conditions.ts` unchanged. The profile mapping stays in the repository for the full
   build.
3. **Content lives in a spreadsheet, is imported by a script, and ships with a deploy.** The flow is: he edits the
   spreadsheet, we run `npm run content:import`, which validates it and writes `content/pilot/*.json`, and then we
   deploy. There is no in-app editor; his scope rules one out. The importer is where content errors are caught,
   with the sheet, row and column named.
4. **Storage is Postgres in Sydney, reached only from the server.** Recommended: Supabase in `ap-southeast-2`, on
   an account the client owns, with Valdis invited. Row-level security is on for every table with no policies, and
   the public API key is never used. The app connects through the transaction pooler with the `postgres` package
   (`prepare: false`). Vercel functions run in `syd1`, next to the data.
5. **A plan has three states, stored separately.** `generated_plan` is the engine's output, `working_plan` holds
   the navigator's edits, and `released_plan` is a frozen snapshot. The family only ever sees `released_plan`.
   Edits keep the original text next to the edited text. This costs nothing now, and the full build's edit-learning
   feature needs it.
6. **Families have no accounts.** Each released plan gets a private link: 32 random bytes, of which only a SHA-256
   hash is stored, with an expiry and a revoke on delete. The link opens the plan, the PDF and the implementation
   request form.
7. **Emails carry a link, never health information.** The release email says a plan is ready and gives the link.
   Navigator notifications give a case reference and an admin link only.
8. **PDFs are generated on demand and never stored.** The existing tested `puppeteer-core` and
   `@sparticuz/chromium` route renders `released_plan` when the family or navigator asks for it. There is no file
   storage to secure or purge.
9. **No AI in the pilot,** as agreed. The engine's output and the navigator's edits give the plan. AI drafting is the
   8-hour add-on after the first families.

## 3. Architecture

### 3.1 Routes

Public routes, each rate-limited and `noindex`:

| Route | Purpose |
| --- | --- |
| `/` | Start page: what the service is, what it is not, "Start" |
| `/start` | Consent, then the questionnaire |
| `POST /api/submit` | Validates, stores the case, generates the plan, returns the thank-you state |
| `/p/[token]` | The released plan, a PDF button and the implementation request form |
| `GET /api/p/[token]/pdf` | The PDF of the released plan |
| `POST /api/p/[token]/request` | Implementation request |

Navigator routes, behind the session in `middleware.ts`:

| Route | Purpose |
| --- | --- |
| `/login`, `/setup/[token]` | Sign in; set a password from a one-time setup link |
| `/admin` | Case list: new, in review, released, closed |
| `/admin/cases/[id]` | Answers, plan editor, preview, release, requests, delete |
| `/api/admin/cases/[id]` (PATCH, DELETE) | Save edits; delete |
| `/api/admin/cases/[id]/release`, `/regenerate` | Release; regenerate from answers |
| `/api/admin/cases/[id]/pdf` | Preview PDF |

System route: `GET /api/cron/retention`, called by Vercel Cron and checked against `CRON_SECRET`.

### 3.2 Code layout (new or reworked)

| Path | What it holds |
| --- | --- |
| `db/migrations/001_init.sql` | Tables below |
| `scripts/migrate.ts` | Applies migrations and records them in `schema_migrations` |
| `scripts/add-navigator.ts` | Creates a navigator and prints a one-time setup link |
| `scripts/content-import.ts` | Spreadsheet to `content/pilot/*.json` |
| `scripts/content-export.ts` | Current content to a pre-filled spreadsheet |
| `scripts/seed-fictional.ts` | Fictional families submitted through the real API |
| `src/lib/db.ts` | One `query()` entry point, server only |
| `src/lib/cases.ts` | Case repository: create, get, list, save edits, release, delete |
| `src/lib/pilot/rule-syntax.ts` | The spreadsheet condition language to `Condition` |
| `src/lib/pilot/content.ts` | Zod schemas for the imported content |
| `src/lib/pilot/engine.ts` | Answers to a plan: pathways, actions, sections |
| `src/lib/pilot/render.ts` | One plan renderer for the web page, preview and PDF |
| `src/lib/email.ts` | Sending through the Resend HTTP API with `fetch`, no SDK |
| `src/lib/links.ts` | Private link tokens |
| `src/lib/ratelimit.ts` | Database-backed limits for sign-in, submit and requests |

### 3.3 Database

| Table | Columns (main) |
| --- | --- |
| `navigators` | id, email, name, password_hash (scrypt, `node:crypto`), setup_token_hash, setup_expires_at, disabled_at |
| `cases` | id, reference (`AN-` plus 6 characters), status, submitted_at, released_at, closed_at, retain_until, questionnaire_version, content_version, consent_version, consent_at, contact_name, contact_email, contact_phone, person_name, answers (jsonb), urgent (bool), pathways (text[]), generated_plan, working_plan, released_plan (jsonb), reviewed_by, updated_at |
| `family_links` | id, case_id, token_hash, created_at, expires_at, revoked_at, last_viewed_at |
| `implementation_requests` | id, case_id, created_at, services (text[]), contact_method, phone, best_time, message, status (new, contacted, closed) |
| `events` | id, case_id (null after deletion), at, actor (navigator id, family or system), type. No personal data, so pilot counts survive deletion |
| `rate_limits` | key, window_start, count |

The case record follows section 44 of his full-build document. The paid tools later add an `orders` table and a
`reports` table keyed on `case_id`, without changing `cases`.

### 3.4 Case status

`submitted` → `in_review` (first opened by a navigator) → `released` (snapshot, link and email) → `closed`.
Deletion removes the case row, its link and its requests, and keeps anonymous events. `urgent` is set at submission
from the urgent-attention question and sorts those cases first, with a red badge.

### 3.5 Content model (the spreadsheet)

The template is pre-filled with the current questions, which came from his own brief, so he edits instead of starting
from nothing. The action wording is pre-filled as well and marked `DRAFT`. Tabs:

| Tab | Columns |
| --- | --- |
| How to use | The condition language with examples; placeholders; what the importer checks |
| Sections | id, title, intro, show when |
| Questions | id, section, pathway, text, help, answer type, options (`value = label`, one per line), allow Unsure / Don't know / Not applicable, required, show when, notes (section 12 of his document) |
| Pathways | id (stay_home, village, residential), name, show when, explanation |
| Situation | show when, sentence (section A) |
| Actions | key, topic, priority, show when, what to do, why it matters, next step, who can help, what to prepare, questions to ask, things to check, source id, status (DRAFT or APPROVED) |
| Information | section (E funding/assessment, G things to check, H professional assessment), show when, title, text, source id |
| Texts | key, text: consent, disclaimer, thank-you page, urgent guidance, release email, CTA per pathway (section 37 of his document), request form options |
| Sources | id, title, publisher, URL, last checked |

The condition language is small, and the importer checks every question ID and option value it names:
- `q8 has memory_or_thinking`
- `q19 is completed`
- `q19 in completed, receiving`
- `q23 is unsure`
- `q11 answered`
- combined with `and`, `or`, `not` and brackets.

Placeholders are a fixed set:
- in rows, `{{name}}` and `{{answer.q12}}` (the labels of a choice answer);
- in fixed texts, `{{name}}` only;
- in the release email, `{{link}}` and `{{expires}}`. They avoid the wording bugs seen in his test plan:
- no gendered pronouns, since the questionnaire does not ask for them;
- no free-text answers inside sentences;
- capitalisation handled by the renderer;
- the cover names the person and, separately, who completed the questionnaire.

Only rows marked `APPROVED` go into a production import. Staging accepts `DRAFT` rows, so building and testing do
not wait for his approvals.

### 3.6 Plan sections

The plan follows section 30 of his document and the pilot scope, and any empty section is left out:

| Section | Contents | Pilot |
| --- | --- | --- |
| Urgent attention | Answers to the urgent-attention question, shown first with his urgent guidance text | Yes, kept from the prototype for safety |
| A. Your current situation | Situation sentences | Yes |
| B. What matters most | His "what matters" answers | Yes |
| C. Your likely pathway | One or more pathways, each with its explanation | Yes |
| D. Your priority actions | The six action fields | Yes |
| E. Funding and assessment information | Information rows | Yes |
| F. Support or provider matches | | Full build |
| G. Things to check | Actions' "things to check" and information rows | Yes |
| H. Professional assessment or advice | Information rows | Yes |
| I. Relevant specialist tool | | Full build |
| J. Implementation option | CTA per pathway, linked to the request form | Yes |
| Sources | Sources cited above, with last-checked dates | Yes |

## 4. Step by step

Each step lists its hours, what is built, and when it counts as done. The steps follow the day order in
`WORKLOG.md`, not the line numbers. Where a step needs something from a later day, it uses the prototype's version
until that day:
- the review screen (day 3) previews through the prototype template until the new renderer (5a, day 6) replaces it
  behind the same function;
- submission (day 4) generates plans with the prototype engine until the pilot engine (3c, day 5) lands;
- release (day 3) takes the snapshot, and the link and email (6a and 6b, day 7) attach to it later.

The check "Verified" means the following, done as the last part of each step:
- the tests and `next build` pass;
- the pages are opened in Chrome at desktop width and at 390 px;
- nothing scrolls sideways and the console shows no errors.

### Line 0: kick-off (4 h, done on day 1)

Full-build document reviewed, its 34 deliverables mapped (`chatting.md` section 13), and the pilot structure planned.

### Line 1: foundation (6 h, 2 done)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 1a | 2 (done) | Prototype audit and pilot structure | This document |
| 1b | 0.5 | Tag `prototype-2026-09-23`, create the `pilot` branch. Delete the console, repository, modules, docs and plan-version routes and `/api/plans/*`, `/api/library`, `/api/schemas`. Rename the brand to Ageing Navigator, with placeholder styling until his assets arrive | `next build` passes; the deleted paths return 404 |
| 1c | 2 | `db/migrations/001_init.sql`, `scripts/migrate.ts`, `src/lib/db.ts`, `src/lib/cases.ts`. Repository tests run against a local Postgres in Docker, and are skipped when `TEST_DATABASE_URL` is not set, as the PDF tests are without Chrome | Create, read, list, save and delete tested |
| 1d | 1 | Navigator accounts: scrypt hashes, `scripts/add-navigator.ts` issues a one-time setup link (no password is ever sent by chat or email), the session carries the navigator id, sign-in limits live in `rate_limits` | Sign-in, wrong password, lock-out and setup link tested |
| 1e | 0.5 | Vercel: environment variables (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`), region `syd1`, a staging deploy on a `*.vercel.app` name. The subdomain follows in 9d when his DNS record is in | Staging reachable, connected to the Sydney database |

### Line 2: questionnaire to storage (6 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 2a | 1 | Question schema: `allowUnsure` adds Unsure, Don't know or Not applicable as standard options; `required`; `pathway` tag. The form renders them | Tests for each answer type with and without Unsure |
| 2b | 1 | Consent before the first question: his consent text with its version, a required checkbox, stored with a timestamp. Contact details kept to what delivery needs: name, email, optional phone | The form cannot start without consent |
| 2c | 2 | `POST /api/submit`: validate, prune hidden answers, store the case, generate the plan, set `urgent`. Thank-you page: "your plan will be sent to (email) once it has been checked", plus his urgent guidance when urgent answers were given. The browser copy is cleared on success. Honeypot field and rate limit against bots | A submitted case appears in the database; the family never sees an unreviewed plan |
| 2d | 1 | "What has changed?" as the first screen (section 5 of his document) and the "I'm not sure what we need" route, both from his content; the progress bar counts only the sections shown | Branching tests for each pathway and for "not sure" |
| 2e | 1 | Mobile and accessibility pass: 390 px, keyboard only, labels, focus order | Verified |

### Line 3: his rules and content (8 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 3a | 1 | Content template (section 3.5), pre-filled from the current questionnaire and draft wording by `scripts/content-export.ts`, and sent to him with the "How to use" tab | He has the spreadsheet (day 2) |
| 3b | 2 | `scripts/content-import.ts` with ExcelJS (a development dependency only), `rule-syntax.ts`, and Zod validation of every tab. Errors name the sheet, row and column, and flag unknown question IDs and option values | The pre-filled template imports cleanly; broken rows give readable errors |
| 3c | 3 | `src/lib/pilot/engine.ts`: pathways (none, one or several), actions with the six fields ordered by priority, information rows by section, situation sentences, urgent block, empty sections omitted, placeholders and the wording fixes in section 3.5 | Engine tests: each fictional family gets the expected pathways and sections, with no unfilled placeholder |
| 3d | 2 | Import his completed spreadsheet, work through the errors with him, adjust the tests to his content | His content is live on staging |

His completed spreadsheet is needed by day 5. If it is late, steps 4 to 7 go ahead on the draft content, and 3d
moves to when it arrives.

### Line 4: review screen (7 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 4a | 1 | `/admin`: case list by status, urgent first. It shows reference, submitted date, pathway and a request flag; no health details in the list | Seeded cases listed and filtered |
| 4b | 2 | `/admin/cases/[id]`: the answers as asked (visible questions only, labels, by section). Plan editor: every section text and action field editable, remove or restore an action, internal note | Edits appear in the preview |
| 4c | 1.5 | Saving: PATCH with an `updated_at` check, so two navigators cannot overwrite each other. Original and edited text are both kept, and events are logged | Concurrency and save tests |
| 4d | 1 | Preview through the same renderer the family sees (line 5), on screen and as a PDF | Preview matches the released page |
| 4e | 1.5 | Approve and release (confirmation, snapshot, then line 6), close, and "Regenerate from answers" (confirmed, discards edits; used when his content changes during line 9) | Status-flow tests |

### Line 5: plan on screen and PDF (6 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 5a | 2 | `src/lib/pilot/render.ts`: the section 3.6 layout, one renderer for the family page, the preview and the PDF; brand settings (logo, colours, fonts) in one place | Sections appear and disappear with content |
| 5b | 2 | PDF on his template: cover, running header and footer, page numbers, disclaimer. Paged CSS reused from `src/doc/templates.ts` | His sample, or our layout with his brand, approved |
| 5c | 1 | PDF routes for the private link and the preview: checked access, `no-store`, `maxDuration` set for cold starts | PDF downloads on staging |
| 5d | 1 | Stress tests with the longest and shortest fictional plans: no overflow, no split action cards, sensible page counts | Tests pass with Chrome |

His logo, colours and any sample of the template are needed by day 6.

### Line 6: release, private link and email (3 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 6a | 1 | `src/lib/links.ts` and `/p/[token]`: hashed token, expiry, revoked on deletion, `noindex`, `no-store` | Expired, revoked and wrong tokens give a plain "link not valid" page |
| 6b | 1.5 | Release email through Resend from his domain: short text and HTML with the link only. Delivery status on the case; "Resend email" and "Copy link" if sending fails | An email arrives with a working link |
| 6c | 0.5 | Send him the DNS records (SPF, DKIM, and the subdomain CNAME) in one message; test delivery to Gmail and Outlook | Not in spam at either |

### Line 7: implementation request (3 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 7a | 1.5 | Form on the family page. The CTA wording follows the pathway (section 37 of his document); the options are his three services plus "Something else"; contact method, optional phone, best time, message. Stored and rate-limited | A request is stored against the right case |
| 7b | 1 | Email to the navigators: "New implementation request, case AN-XXXXXX", with the admin link and no personal details | Email received |
| 7c | 0.5 | Request shown on the case and flagged in the list; status new, contacted, closed | Verified |

### Line 8: privacy and security (4 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 8a | 1 | Access review: every `/admin` and `/api/admin` route behind the session; the public routes are only those in 3.1; row-level security on with no policies; secrets only in Vercel; the log allow-list still has no personal data | A checklist in the handover note, each item tested |
| 8b | 1.5 | Retention: `retain_until` set at release (period from the client; propose 12 months after release, and 60 days for cases never released). A daily Vercel Cron deletes expired cases. "Delete now" on the case, with a typed confirmation | Cron and deletion tested; the links stop working |
| 8c | 1 | Backups: the database's daily backups (a paid tier; the client decides), and one restore tried on staging, written up | Restore steps in the handover note |
| 8d | 0.5 | Facts sheet for his privacy statement: what is collected and why, where it is stored (Sydney, Australia), who can see it, retention, deletion on request, no AI, and what to do after a breach (Privacy Act 2020 notifiable breaches) | Sent to him with a request for his privacy wording |

### Line 9: fictional-family run (8 h)

| # | Hours | Work | Done when |
| --- | --- | --- | --- |
| 9a | 1 | Seven or eight fictional families (phone `0123456789`) covering each pathway, "not sure", urgent, dementia, hospital discharge and carer strain, submitted through the real API on staging by `scripts/seed-fictional.ts` | All appear in the review list |
| 9b | 1 | Our own end-to-end pass: submit, review, edit, release, email, link, PDF, request, delete, at desktop and 390 px | Verified; issues fixed |
| 9c | 5 | His run: he fills in the questionnaire himself, reviews, releases to his own inbox and requests help. Fixes, and the one round of wording changes (re-import, regenerate) | His list of issues closed |
| 9d | 1 | Go-live: production environment, his subdomain, real navigator accounts, test data deleted, first real family | Live on his subdomain |

### Line 10: handover note (1 h)

The note covers:
- how to change content (spreadsheet, import, deploy);
- how to add or disable a navigator;
- environment variables and where each secret lives;
- backups and restore;
- retention and deletion;
- running costs;
- known limits;
- the access checklist from 8a;
- what the full build adds.

## 5. What the client has to supply, and when

| By | What | Used in |
| --- | --- | --- |
| Day 2 | Database account (Supabase, Sydney) in his name, with Valdis invited | 1c, 1e |
| Day 5 | The completed content spreadsheet | 3d |
| Day 6 | Logo, colours, any sample of the plan template | 5a, 5b |
| Day 7 | DNS records added for email sending and the subdomain | 6c, 9d |
| Day 9 | Time to run the fictional families, and his privacy and disclaimer wording | 9c, 8d |

When an input is late, move the next independent step forward, and tell him the day it becomes the limit.

## 6. Testing

- **Unit tests (Vitest):**
  - rule syntax;
  - importer validation;
  - pilot engine per fictional family;
  - renderer sections;
  - tokens;
  - rate limits.
- **Database tests:** against Postgres in Docker; skipped without `TEST_DATABASE_URL`.
- **PDF tests:** with `CHROME_PATH=/usr/bin/google-chrome`, as now.
- **Browser checks:** `playwright-core` with `/usr/bin/google-chrome`, at desktop and 390 px, on every page a step
  touches. Check for sideways scroll and console errors.
- **Prototype tests:** the existing 69 keep running while the prototype library code stays in the repository.
  Tests for deleted routes are deleted with them.

## 7. Decisions for Valdis before day 2

1. **Hosting account.** Recommended: run the pilot on the `servi-tec` team, which is already set up, and transfer
   the Vercel project to his account at handover. The alternative is his own Vercel Pro account from the start,
   which is needed for commercial use and has a cost. The database is in his account either way.
2. **Database.** Supabase in Sydney is recommended. Daily backups need a paid tier; check the current price before
   telling him.
3. **Email.** Resend, sending from his domain. The free tier covers a pilot.
4. **Retention period to propose:** 12 months after release, and 60 days for cases never released.
5. **The additions in section 8:** decided, they are built (line 11).

## 8. Small additions, included

The user decided on 2026-09-30 to build these as part of the pilot. They are tracked as line 11 in `WORKLOG.md`
(3.5 hours), on top of the 56.

| Addition | Hours | Why | Where it fits |
| --- | --- | --- | --- |
| Email to the navigators on each new submission, marked when urgent | 0.5 | Someone who reports an urgent concern should not wait for the next time a navigator happens to look | After 7b, same mechanism |
| Referral source from `?ref=` links, kept on the case | 1 | Section 42 of his document; cheap now, costly to add to existing cases later | 2c |
| Feedback questions (section 41) on the family page, saved with the case | 1 | His pilot question "do they find it useful" otherwise needs a phone call per family | After 7a |
| CSV export of cases | 1 | Pilot evaluation without database access | After 4a |

## 9. Risks

| Risk | What to do |
| --- | --- |
| His content is late or arrives in another form | Build on the draft content. Content in another form, or changes beyond the one round, is extra time: say so when it happens |
| Rule syntax is hard for him to write | Worked examples in the template; the importer's messages; fix together in 3d. Translating rules written in plain English is extra time |
| Line 3 overruns (the new engine is the biggest unknown) | Check at the end of day 5 and tell him the same day if it will pass 8 hours |
| He asks for AI, matching or a paid tool during the pilot | New work, estimated first. Point to his own principle that future scalability must not grow the pilot unless agreed |
| Email lands in spam | DNS records from 6c; plain, short emails; test before go-live |
| PDF cold starts on Vercel | Keep the tested Chromium set-up; set `maxDuration`; test on staging |
| A family reports something urgent while the plan waits for review | Urgent guidance on the thank-you page (2c), urgent cases first (4a); offer the notification in section 8 |

## 10. Groundwork for the full build

What the pilot leaves ready, at no extra cost:
- **Questions with a `pathway` column,** so the deep pathway questions of the full build are more rows, not new code.
- **One condition language** for questions, pathways, actions and information. Matching rules and funding rules
  can use it too.
- **Every action and information row carries a source id,** and sources carry a last-checked date. This is the seed
  of the knowledge repository (sections 14 and 15 of his document).
- **A case record shaped like section 44.** Orders, payments and paid reports attach by `case_id`.
- **One renderer** for web, preview and PDF. The two paid reports become new section layouts on the same renderer.
- **Original and edited text both kept,** for the edit-learning feature later.
- **The prototype's matching, providers and versioning** are kept in `src/lib` and at the tag, for milestones 4 and 5
  of his plan (Retirement Village pathway and matching first).

## 11. Not in the pilot

These are out of scope unless separately agreed:
- paid tools, payments, financial repository or calculations;
- provider, village or care matching;
- knowledge or provider management screens;
- AI;
- family accounts;
- a questionnaire editor;
- analytics dashboards, CRM, automated follow-ups, an API.

A request for any of these is new work, estimated before it starts.
