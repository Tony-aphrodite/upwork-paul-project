# Ageing Navigator: pilot

A family answers a questionnaire and receives a personalised **Family Ageing Action Plan** at once. It is built from
the client's approved wording and sent the moment they finish, with no review step (the client's decision,
2026-10-13). The plan is linked from the thank-you page and emailed as a private link. A navigator is emailed, and can
edit the plan and send an updated version. From the plan the family can ask Ageing Navigator to help coordinate their
next steps.

```
ageingnavigator.com (the client's site) → /start: reason cards, consent, conditional questions, contact
  → case stored, plan generated from approved content and released at once
  → thank-you page and email with a private link → /p/…: plan, PDF, coordination request, feedback
  → navigators emailed; /admin: read, edit, preview, Release again (a new link replaces the old)
```

The earlier proof of concept is kept at the git tag `prototype-2026-09-23`: its provider matching, repository and
plan versioning are there for the full build. The pilot branch contains only what the pilot uses.

## Run it locally

Node 20. No database to install: without `DATABASE_URL` the app uses PGlite, a Postgres that runs in-process, and
stores its data in `.data/pglite`.

```bash
npm install
npm run navigator -- --email you@example.test --name "Your name"   # prints a one-time setup link
npm run dev                                                         # http://localhost:3000, open the setup link
npm run seed:fictional                                              # submits the fictional families (server running)
npm test                                                            # CHROME_PATH=/usr/bin/google-chrome adds the PDF tests
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm test   # the same tests on a real Postgres (local only)
```

With `TEST_DATABASE_URL` each test file creates its own database on that server and uses the production driver, so
the code path that runs on Supabase is tested too. Point it only at a local, disposable server.

**In a real browser:** `npm run check:browser` follows the whole pilot in Chrome at desktop width and at 390 px.
- **What it does:** submits fictional families, signs in, edits, releases, opens the family page and PDF, sends a
  request and feedback, and exports CSV.
- **What it checks on every page:**
  - sideways scrolling and console errors;
  - accessibility with axe-core (WCAG 2.0 to 2.2, levels A and AA);
  - a keyboard sweep: Tab through the page, and every stop must show a visible focus indicator.

  Screenshots go to `.browser-check/`. `VERBOSE=1` prints how many keyboard stops each page has.
- **Settings:** `BASE`, `NAV_EMAIL` and `NAV_PASSWORD` (or `SETUP_TOKEN`), and `CHROME_PATH`.
- **Where to point it:** a local or staging app only, never production with real families.

PGlite allows one process at a time: stop the dev server before running `navigator` or `db:migrate` against it.

**Careful with `demo/.env.local`.**
- **The risk:** it holds the staging `DATABASE_URL`, and `next dev` and `next start` read it on their own, so a plain
  `npm run dev` works on the client's staging database.
- **To stay on the local PGlite:** start with an empty value: `DATABASE_URL= npm run dev`.
- **Scripts run with `tsx`** (`navigator`, `seed:fictional`) do not read it, unless you load it yourself.
Emails are not sent locally. They are kept in memory, and the server log records that a message was sent.

## Configuration (production)

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Supabase in Sydney (`ap-southeast-2`), transaction pooler (port 6543) |
| `DATABASE_CA_CERT` | Optional: Supabase's CA certificate (PEM). With it the database certificate is fully verified; without it the connection is encrypted but not verified |
| `AUTH_SECRET` | 32+ random characters; signs navigator sessions. The app refuses to start without it wherever real data is |
| `APP_URL` | Public address, e.g. `https://plan.ageingnavigator.com`; used in emails and links |
| `RESEND_API_KEY` | Resend API key, from an account on the client's domain |
| `EMAIL_FROM` | e.g. `Ageing Navigator <plans@ageingnavigator.com>`; the domain must be verified in Resend |
| `EMAIL_REPLY_TO` | Optional: where family replies go |
| `CRON_SECRET` | 32+ random characters; the daily retention job checks it |
| `REQUIRE_APPROVED_CONTENT` | `1` on the real production: no submissions and no releases while any content row is still Draft. Leave unset on staging |
| `RETENTION_MONTHS_AFTER_RELEASE` | Default 12 |
| `RETENTION_DAYS_UNRELEASED` | Default 60 |

On Vercel, `vercel.json` runs the functions in Sydney (`syd1`) and calls `/api/cron/retention` once a day.
Migrations run by themselves the first time the app opens the database (under a lock, so two cold starts cannot
collide). `DATABASE_URL=… npm run db:migrate` does the same by hand.

## Brand and documents

- **Brand values:** `src/lib/brand.ts` holds the colours, name and confirmed contact details, from the client's Brand
  Guide v1 (`client-files/brand/`). `tailwind.config.ts`, the PDF and the emails all read it.
- **The logo:** `src/brand/logo.png` for the pages, `src/doc/brand-inline.ts` for the PDF cover, and
  `public/brand/logo-email.png` for the emails. All three are cut from his artwork; do not redraw or recolour it.
- **Fonts:** Poppins (SIL Open Font Licence) in `src/doc/fonts/`. After changing the PDF fonts, run
  `npm run fonts:inline`.
- **Client documents:** they are Markdown files in `../deliverables/`.
  `CHROME_PATH=/usr/bin/google-chrome npm run doc:pdf -- ../deliverables/Navigator-guide.md` writes the branded PDF
  beside the file.

## Changing the content

Questions, branching, pathways, sentences, actions, information, texts, services and sources all live in
`content/pilot/content.json`. It is edited through the content spreadsheet, not by hand:

```bash
npm run content:export -- content.xlsx          # current content, with a "How to use" tab
npm run content:import -- content.xlsx          # checks everything; lists problems by tab, row and column
npm run content:import -- content.xlsx --production   # refuses rows still marked Draft
npm test && deploy
```

Rows marked Draft make the whole content a draft: the family pages and PDFs then say "Test version".
Cases keep the plan they were generated with. "Regenerate from answers" on a case rebuilds it with the current content.

**The condition language** (the "Show when" columns) reads like `q8 has falls`, `q19 in completed, receiving`,
`q21.epoa_property is no` or `q11a answered`, combined with `and`, `or`, `not` and brackets. See `src/lib/pilot/rule-syntax.ts`.
A condition may only use questions asked earlier (by section order, then question order).

**Option descriptions and cards:**
- **The form:** an option written as `value = Label | A short description` shows the description under the label.
- **Cards:** when every option of a single-choice question has a description, families see the question as cards,
  and choosing one moves on.
- **The opening screen:** if the first section holds only such a question (`trigger`, "What has brought you here?"),
  it opens the questionnaire before the consent step. Nothing leaves the browser before consent.

**Links from the client's website** (`/` forwards to `/start`, keeping these):
- `/start?reason=dementia_diagnosis` answers the cards in advance, and the family starts at consent.
- `/start?for=self` answers q1 ("for myself").
- `&ref=website` records where the family came from.

**Placeholders:** rows (situation, what matters, actions, information) may use `{{name}}` and `{{answer.ID}}` for a
choice question; a row whose answer says nothing specific is left out. Fixed texts (introduction, invitations, pathway
explanations) may use `{{name}}` only; the release email uses `{{link}}` and `{{expires}}`. The importer checks all of it.

## Navigator accounts

```bash
npm run navigator -- --email dee@example.test --name "Dee"     # new account, or a new setup link (password reset)
npm run navigator -- --email dee@example.test --disable        # takes effect at once
```

The setup link works once, for 48 hours. The navigator chooses their own password (12 characters or more), so no
password is ever sent to anyone. Issuing a new link is a reset: the old password and every open session stop working
at once. Disabling does the same.

## Privacy and security

- **Access.**
  - Everything under `/admin` and `/api/admin` needs a navigator session (`src/middleware.ts`). Every admin page and
    route checks again that the account is active and the session is newer than its last reset.
  - Changes (POST, PATCH, DELETE) must come from this site (Origin check); the session cookie is SameSite=Lax,
    so the case link in a navigator's email opens signed in.
  - Production pages send a Content Security Policy; sources in plans must be https addresses.
  - The family's pages are reached only through their private link: 32 random bytes, of which only the SHA-256 hash
    is stored. The link expires with the case and stops working when a new link is issued.
- **The database.**
  - It is reached only from the server.
  - Row-level security is on for every table with no policies, so the hosting provider's public API reads nothing.
- **Minimal data.**
  - Contact details are only what delivery needs.
  - Free text is limited in length and never placed inside plan sentences.
  - IP addresses are never stored; rate limits key on a keyed hash.
  - Logs pass an allow-list (`src/lib/log.ts`) and hold no personal data.
- **Email.** Emails carry links and case references, never health information. The family's PDF carries no link, so
  a forwarded PDF opens nothing.
- **Errors.** Unexpected errors are logged by code only, so a database message quoting a row never reaches the logs.
- **Retention.**
  - A released case is deleted `RETENTION_MONTHS_AFTER_RELEASE` after release; a case never released is deleted
    after `RETENTION_DAYS_UNRELEASED`. The daily job does this.
  - Navigators can delete a case at once; they type its reference to confirm.
  - The `events` table keeps only anonymous counts.
- **No AI.** No family information is sent to an AI provider.
- **Backups.** Daily backups come from the database provider's paid tier. Test a restore before go-live.

## Where things are

| Path | What it is |
| --- | --- |
| `content/pilot/content.json` | The content (compiled from the spreadsheet) |
| `src/lib/pilot/` | Content schema, spreadsheet compiler, condition language, engine, plan schema, renderer |
| `src/lib/cases.ts`, `navigators.ts`, `db.ts`, `migrations.ts` | Storage |
| `src/lib/rules/condition.ts` | The condition format shared by questions, content and, later, matching and funding rules |
| `src/lib/route.ts` | The shape every API route shares: session and Origin checks, 404/409, error logging |
| `src/lib/validate.ts`, `case-status.ts` | Rules and labels shared by the browser and the server |
| `src/app/start/` | The family questionnaire |
| `src/app/p/[token]/` | The family's plan page |
| `src/app/admin/` | Case list and review screen |
| `src/app/api/` | Submit, family link routes, admin routes, sign-in, retention |
| `scripts/` | Content import and export, navigator accounts, migrations, fictional families |
| `tests/pilot-*.ts` | Content, engine, database, API and renderer tests; `pilot-families.ts` holds the fictional families |

The prototype's engine, profile mapping, templates, providers and matching were removed from this branch on
2026-10-01 after the code review; they are intact at the tag `prototype-2026-09-23`.
