# Ageing Navigator: pilot

A family answers a questionnaire and receives a personalised **Family Ageing Action Plan**. A navigator checks and
edits every plan before it is released. The family then gets a private link to the plan and its PDF, and can ask
Ageing Navigator for help from there.

```
/start: consent, conditional questions, contact
  → case stored, plan generated from approved content, navigators emailed
  → /admin: navigator reviews, edits, previews, releases
  → email with a private link → /p/…: plan, PDF, help request, feedback
```

The earlier proof of concept is kept at the git tag `prototype-2026-09-23`.

## Run it locally

Node 20. No database to install: without `DATABASE_URL` the app uses PGlite, a Postgres that runs in-process, and
stores its data in `.data/pglite`.

```bash
npm install
npm run navigator -- --email you@example.test --name "Your name"   # prints a one-time setup link
npm run dev                                                         # http://localhost:3000, open the setup link
npm run seed:fictional                                              # submits the fictional families (server running)
npm test                                                            # CHROME_PATH=/usr/bin/google-chrome adds the PDF tests
```

PGlite allows one process at a time: stop the dev server before running `navigator` or `db:migrate` against it.
Emails are not sent locally. They are kept in memory, and the server log records that a message was sent.

## Configuration (production)

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Supabase in Sydney (`ap-southeast-2`), transaction pooler (port 6543) |
| `AUTH_SECRET` | 32+ random characters; signs navigator sessions |
| `APP_URL` | Public address, e.g. `https://plan.ageingnavigator.co.nz`; used in emails and links |
| `RESEND_API_KEY` | Resend API key, from an account on the client's domain |
| `EMAIL_FROM` | e.g. `Ageing Navigator <plans@ageingnavigator.co.nz>`; the domain must be verified in Resend |
| `EMAIL_REPLY_TO` | Optional: where family replies go |
| `CRON_SECRET` | 32+ random characters; the daily retention job checks it |
| `RETENTION_MONTHS_AFTER_RELEASE` | Default 12 |
| `RETENTION_DAYS_UNRELEASED` | Default 60 |

On Vercel, `vercel.json` runs the functions in Sydney (`syd1`) and calls `/api/cron/retention` once a day.
After the first deploy, and after any new migration, run `DATABASE_URL=… npm run db:migrate`.

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

## Navigator accounts

```bash
npm run navigator -- --email dee@example.test --name "Dee"     # new account, or a new setup link (password reset)
npm run navigator -- --email dee@example.test --disable        # takes effect at once
```

The setup link works once, for 48 hours. The navigator chooses their own password (12 characters or more), so no
password is ever sent to anyone.

## Privacy and security

- **Access.**
  - Everything under `/admin` and `/api/admin` needs a navigator session (`src/middleware.ts`), and every admin
    route checks again that the account is active.
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
- **Email.** Emails carry links and case references, never health information.
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
| `src/app/start/` | The family questionnaire |
| `src/app/p/[token]/` | The family's plan page |
| `src/app/admin/` | Case list and review screen |
| `src/app/api/` | Submit, family link routes, admin routes, sign-in, retention |
| `scripts/` | Content import and export, navigator accounts, migrations, fictional families |
| `tests/pilot-*.ts` | Content, engine, database, API and renderer tests; `pilot-families.ts` holds the fictional families |

The prototype's library code (`src/lib/engine`, `src/lib/questionnaire/map.ts`, `src/doc/templates.ts`, providers and
matching) stays for the full build, with its tests.
