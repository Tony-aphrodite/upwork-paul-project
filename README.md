# Kinfield Action Plans: proof of concept

A first version of a **living Family Action Plan system** for an ageing-navigation service: family information in, a structured Action Plan out, and two professional PDFs (the full plan and a 1 to 2 page Professional Summary) generated from that data.

Everything here is fictional: the families, the provider list and the name "Kinfield Navigator". The phone number is a placeholder.

```
Questionnaire data → Family Profile (validated) → Action Plan (structured, versioned) → HTML/CSS template → PDF
```

## Run it

```bash
npm install
npm run dev                                   # http://localhost:3000, demo password: navigator-demo
CHROME_PATH=/usr/bin/google-chrome npm run dev   # local PDF generation uses an installed Chrome
npm test                                      # 39 tests (the PDF test runs when CHROME_PATH is set)
npm run schemas                               # writes schemas/*.schema.json
CHROME_PATH=... npm run samples               # renders both PDFs for every test case into samples/
```

On Vercel, PDFs use `@sparticuz/chromium`. Set `AUTH_SECRET` (and optionally `ADMIN_PASSWORD`).

## What is where

| Path | What it is |
| --- | --- |
| `src/lib/schema.ts` | The contracts (Zod): Family Profile, Action Plan, Action, Module definition, Provider. Exported as JSON Schema in `schemas/` and at `/api/schemas/{name}` |
| `src/lib/engine/` | The plan engine: pure functions, no I/O. Conditions, templating, "what you told us", generation, versioning, diffs, transparent provider matching |
| `content/modules.json` | The 18 modules from the brief, as data: when each applies, its priority rules, text and actions |
| `content/sources.json` | Sources cited in the plan, with review dates |
| `content/cases.json` | Seven fictional families: the six from the brief plus a long-content stress case |
| `content/providers.json` | Sample providers for the matching demo (fictional) |
| `src/doc/templates.ts` | The two document templates (HTML/CSS), shared by the browser preview and the server PDF |
| `src/doc/pdf.ts` | Headless Chromium: HTML in, PDF bytes out, nothing written to disk |
| `src/app/api/` | Sign-in, generate, validate, documents, schemas, library |
| `src/app/admin/` | The test console: load cases, paste or upload data, edit progress, change the profile, regenerate, preview, download, compare versions, add modules |
| `src/app/docs/` | Technical documentation for future integration |
| `samples/` | Rendered PDFs for all seven test cases |

## Design decisions

- **The plan is data; the PDF is a view.** Each action is its own record with a stable key, priority, timing, owner, status, source and notes. Any system can read the plan as JSON; the PDF is regenerated from it at any time.
- **Modules are content, not code.** Conditions use a small safe vocabulary (`eq`, `in`, `gte`, `truthy`, … combined with `all`, `any`, `not`). A module that does not apply never appears. New modules are added as records, validated by schema, with no rebuild; the admin Modules page demonstrates this.
- **A living plan.** Regenerating after a profile change passes the previous version to the engine: status, notes and owners carry over by key, actions that no longer apply are kept as "No longer required", and navigator, family or AI actions are never dropped. Every version is immutable and records what changed.
- **Transparent options.** Where providers are shown, each lists the criteria it matches, does not match, or cannot confirm. There is no hidden ranking or "recommended" label.
- **Ready for AI, without depending on it.** AI output must match the same schemas. The console shows a model's suggested action being validated, rejected with field paths when wrong, and added with `source: "ai"` when right.
- **Documents that survive real content.** Paged-media CSS (A4, running footers, "Page X of Y", repeated table headers, no split rows or cards), embedded fonts, and wrapping for long words and URLs. Tests render every case and check page counts and overflow.
- **Private by default.** Signed session cookie for all admin pages and APIs, rate-limited sign-in, an allow-list logger that cannot write personal data, PDFs streamed with `no-store`, JavaScript disabled in the PDF renderer, and `noindex` everywhere.

## Tests

| Suite | Covers |
| --- | --- |
| `tests/engine.test.ts` | Schemas and content integrity (every condition field exists in the profile schema, every cited source exists, no unfilled placeholders), module selection and priority for each test family, versioning and carry-over, provider transparency, adding a module as data |
| `tests/documents.test.ts` | Escaping, omitted sections, cover details, every action in the table and checklist, the summary's required items; with Chrome: PDFs for every case, summaries within 2 pages, and no element wider than the page |
| `tests/api.test.ts` | Generate, validate and schema endpoints, input limits, the middleware guard, sign-in and rate limiting, log redaction |

Five core rules (escaping, status carry-over, module conditions, the auth guard, keeping retired actions) were each broken on purpose; the suite failed every time.

## Demo limits

The demo has no database: the console keeps fictional plans in the browser, and the server is stateless. Production adds Postgres (plans, immutable versions, an actions table for reminders), encrypted object storage for PDFs with signed expiring links, and an audit log. See `/docs` for the table design and integration points.
