# Ageing Navigator pilot: handoff

Written 2026-09-30 and kept up to date since. **Since 2026-10-01 the whole project lives in this git repository
(public, by the user's decision; never commit secrets or real families' data):**
- the code (`demo/`, with its history);
- the notes;
- the client log;
- the client's documents;
- the working rules (`CLAUDE.md`).

**To continue on any computer:**
1. Clone it and follow `README.md`.
2. Open the repository root in Claude Code.
3. Read this file, then the last sections of `chatting.md`, then `IMPLEMENTATION-PLAN.md` section 0 and
   `WORKLOG.md`.

The bidding workspace it came from is frozen.

## Status

- **2026-09-30:** the client approved the 52-hour plan (option A: turn the existing prototype into a pilot that is
  safe for real families) and sent an Upwork offer. The user is accepting it.
- **Contract: hourly at US$10 an hour** (confirmed 2026-09-30, `chatting.md` section 12). The 52 hours are an
  estimate, not a cap:
  - track time per line of the table below in `WORKLOG.md`;
  - use the Upwork Time Tracker with memos (only tracked time is payment-protected);
  - flag overruns early.
- **2026-09-30, later:** he confirmed the start ("go ahead with your 56 hour plan"; he means the 52) and sent
  `client-files/Build Plan - Ageing Navigator.pdf`, the **full-build** brief with two NZ$99 paid tools. He wants the
  paid tools **after** the pilot is complete and tested. Build the pilot as agreed, shaped on that document's
  architecture. The mapping of its 34 deliverables to the prototype and the plan is in `chatting.md` section 13.
  A reply offering three small additions (referral source, feedback, CSV export, about 3 hours) was drafted there
  but **not sent**; the additions are not agreed.
- **Plan: 56 hours** (the client's figure): the ten lines plus a 4-hour kick-off line. Day one (6 hours: kick-off,
  document review, prototype audit) is logged. The day-by-day plan is in `WORKLOG.md`; day 2 starts with the
  content spreadsheet and case storage. The step-by-step build is in `IMPLEMENTATION-PLAN.md`; its section 7 lists
  the decisions the user makes before day 2.
- **2026-10-01, later: full code review done.** Four reviews found about 50 issues, all important ones fixed. Details
  are in `IMPLEMENTATION-PLAN.md` section 0. They include:
  - jsonb double-encoding in production;
  - urgency missed when the answer was "Not sure";
  - account reset and lockout;
  - duplicate submissions;
  - removal of the prototype code.

  Tests now run on a real PostgreSQL 16 as well.
- **2026-10-01, evening:**
  - **Client message sent** (`chatting.md` section 15): the content spreadsheet, and the list of what is needed from
    him.
  - **Upwork memos:** days 1 to 3 are posted. The plan for days 4 to 8 (hours set by the user, memo drafts per slot)
    is in `WORKLOG.md`. Day 4 has started: the keyboard-only check is half done.
  - **Staging:** the Vercel project `ageing-navigator-pilot` (team servi-tec) has its secrets set and
    `deploy-pilot/deploy.sh`. It waits for a staging database, which the user creates in Supabase (Sydney).
- **2026-10-01: the pilot is built.** The code is in `demo/` of this repository; push only with the user's approval. Status per step and what is waiting is in `IMPLEMENTATION-PLAN.md` section 0. Waiting on
  the client:
  - Supabase and Resend accounts in his name;
  - his DNS records;
  - his completed content spreadsheet;
  - brand assets;
  - a backup tier;
  - his fictional-family run.

  The pre-filled content spreadsheet is ready in `deliverables/` and has not been sent yet.

## The client and the product

- **The client and the service:** the founder of **Ageing Navigator**, a New Zealand service for families of older
  people.
  - A family answers a questionnaire and receives a personalised **Family Ageing Action Plan**.
  - The service is **not** medical, legal or financial advice and **not** a needs assessment. Wording must stay as
    "possible pathway to investigate". Never write eligibility decisions, care levels, clinical conclusions or
    financial advice.
- **Pilot region:** Bay of Plenty. Funding rules differ by region.
- **The pilot tests only three things:** do families finish the questionnaire, do they find the plan useful, do
  some ask for help implementing it. His scope document is `pilot-scope-v2.txt`, the "Bare Minimum Pilot".
- **The business question behind it:** how many families need implementation help, and how many would pay for it.
- **He wrote his briefs with ChatGPT** (he said so). Treat them as a starting point, not a specification.
- **Privacy law:** the pilot holds health information about New Zealanders, so the NZ Privacy Act 2020 and the
  Health Information Privacy Code apply.

## What was agreed (the contract in practice)

The client approved this list, sent on 29 September (the exact text is in `chatting.md` section 5, "Exact text
sent"):

| # | Work | Hours |
| --- | --- | --- |
| 1 | Start from the prototype, remove what is out of scope, case storage, navigator sign-in, hosting on his subdomain | 6 |
| 2 | Questionnaire with his final questions and branching, Unsure / Don't know answers, consent at the start, mobile | 6 |
| 3 | His rules and approved content, the plan in its sections, empty sections left out | 8 |
| 4 | Review screen: read, edit wording, remove an action, approve and release | 7 |
| 5 | The plan on screen and as a PDF on his template | 6 |
| 6 | On release, a private link for the family and an email with it | 3 |
| 7 | The implementation request form, with an email to him when one arrives | 3 |
| 8 | Privacy and security: only what is needed, navigator-only access, retention and deletion, backups | 4 |
| 9 | Running the fictional families through with him, and fixing what that turns up | 8 |
| 10 | A short handover note | 1 |
| | **Total** | **52** |

**Terms stated to him:**
- **Content:** his questions, branching, rules and approved wording arrive final, in a spreadsheet we send him. One
  round of wording changes is included, during the fictional-family run. Content that arrives in another form, or
  later changes, is extra time. Say so when it happens.
- **Review before release:** the family finishes and is told their plan will be sent once it has been checked. He
  reviews, edits and releases it. The family then receives a private link to the plan and the PDF. Families never
  see an unreviewed plan.
- **No AI in the 52 hours.** He was told his approved wording with the family's details filled in, plus his edits,
  gives the same plan and keeps health data away from an AI provider. AI wording is **about 8 more hours** once the
  first families have been through. He has since shown interest in OpenAI drafting (sections 6 to 8, for a Google
  Forms route he did not choose), so expect the question again. If he wants it, it is the 8-hour add-on, with
  consent wording, names stripped before the call, and output checked against his approved action library.
- **Release email** is automated. Sending it manually would have saved 3 hours; he did not take that option.
- **Order of work:** storage and his review step first, so fictional families can be tested early.
- **Day one:** send him the content spreadsheet template.
- **Rates:** US$10 an hour for this pilot. **US$12 an hour** for the main build afterwards, conditional on his
  judging the pilot a success. The fictional-family acceptance run is what makes that judgement concrete.

**Out of scope for the pilot** (his list, section "Explicitly Out of Scope" of `pilot-scope-v2.txt`):
- knowledge and provider repositories, village and care databases, matching and ranking;
- family accounts, portal or record, progress tracking, plan regeneration and version history;
- questionnaire and content editors, the edit-learning dashboard, referral dashboards;
- case management, analytics, CRM, automated follow-ups, payments, subscriptions, an API.

The prototype contains several of these (matching, repository view, versioning, test console). Item 1 removes them
from the pilot's surface. Keep the code if it is harmless and unreachable, since the main build will want it.

## Standing constraints with this client

- **The user cannot take video calls with him.** Offer written answers or a recorded walkthrough instead.
- **With the contract active,** sharing a Google address, Drive folders and email is fine. Payments and milestones
  stay on Upwork.
- **Replies follow the rules in `CLAUDE.md`:** English, signed Valdis, no question at the end when he
  is ready, short when the user asks for short.

## The codebase (`demo/`)

- **Where the code is:** `demo/` of this repository, with its full history.
  - It was imported from the original code repository https://github.com/Tony-aphrodite/9-22-Finfield-Action, whose
    `main` still holds the prototype at `3455f32`.
  - Here the prototype is tag `prototype-2026-09-23`; in that commit the code sits at the root, before it moved
    into `demo/`.
  - Do not push this repository to that one: this one holds the client's conversation and documents.
- **Live prototype (old):** https://kinfield-plans.vercel.app (Vercel project `9-22-finfield-action`). Leave it as
  it is.
- **Pilot staging:** https://ageing-navigator-pilot.vercel.app (Vercel project `ageing-navigator-pilot`, team
  `servi-tec`). Deploy with `deploy-pilot/deploy.sh`, which exports a git-free copy as `CLAUDE.md` describes.
- **Stack:**
  - Next.js 15.5 App Router, React 19, TypeScript, Tailwind;
  - Zod 4 schemas, exported as JSON Schema;
  - PDF from HTML/CSS with `puppeteer-core` and `@sparticuz/chromium` on Vercel (locally, set
    `CHROME_PATH=/usr/bin/google-chrome`);
  - Vitest: about 92 tests (the PDF ones need Chrome), on PGlite and, with `TEST_DATABASE_URL`, on a real Postgres;
  - `npm run check:browser`: the whole pilot in Chrome at desktop and 390 px.
- **Run:** `npm run dev` (port 3000); `npm test`; `CHROME_PATH=/usr/bin/google-chrome npm test` for the PDF tests.
  `node_modules` is included in this copy.
- **Environment:** `AUTH_SECRET`, and `ADMIN_PASSWORD`, which defaults to the public demo password `navigator-demo`.
  It must be set for real.
- **Layout** (see `demo/README.md`):
  - `content/questionnaire.json`: 66 questions, five conditional sections;
  - `content/modules.json`: 18 modules with conditions, priorities and actions;
  - `content/sources.json`;
  - `content/cases.json`: seven fictional families;
  - `src/lib/engine/`: pure plan generation;
  - `src/lib/questionnaire/`: conditions and the answers-to-profile mapping;
  - `src/doc/templates.ts` and `src/doc/pdf.ts`: the plan and PDF;
  - `src/app/questionnaire/`: the family flow;
  - `src/app/admin/pilot/`: the review queue;
  - `src/lib/auth.ts`: a signed-cookie sign-in with rate limiting;
  - `src/lib/log.ts`: an allow-list logger with no personal data.

**What the prototype lacks for real families** (checked in the code on 2026-09-30):
1. **No server storage.** `src/lib/workspace.ts` and the questionnaire keep cases in the browser (`localStorage`),
   so a family's answers never reach the navigator.
2. **The sign-in uses the public demo password,** shown on `/login`.
3. **Placeholder content and branding.** The wording is ours, written from his brief and not approved by him. The
   name "Kinfield Navigator" and the fictional families are placeholders.
4. **No consent, retention, deletion or backups.**
5. **Release, the private family link, the release email and the implementation-request form** are not wired to
   anything real.

**Wording bugs visible in his test plan** (`client-files/Action Plan 2 (from client).pdf`, which he generated
himself). Fix these in the rules and templates:
- "dad" appears in lower case;
- "their partner" and "her" are mixed in one sentence;
- his free-text "i'm not sure" is printed as given;
- "Prepared for Paul McLaren, Son or daughter" reads awkwardly.

## Next steps

1. **Accept the offer** (hourly, US$10). Start `WORKLOG.md` with the ten lines of the 52-hour table, and log every
   session against them.
2. **Day one:**
   - Send the content spreadsheet template, with tabs for:
     - Questions: id, section, text, answer options, shown-when condition, allows Unsure;
     - Rules: condition, action key;
     - Approved wording, per action: what to do, why it matters, next step, who may help, what to prepare,
       questions to ask, things still to check.
   - Mirror the shape of `content/questionnaire.json` and `modules.json`, so loading it is mechanical.
   - Use the question columns of section 12 and the action fields of section 30 D of his full-build document, and
     add source and last-checked columns to the wording.
   - Also ask him for his logo, colours and the domain for the subdomain.
3. **Decide and state, don't ask** (per the workspace rules):
   - **Database:** Postgres in Sydney (for example Supabase `ap-southeast-2`), on an account he owns, with you
     invited.
   - **Hosting:** Vercel on a subdomain of his WordPress site. He adds one DNS record.
   - **Release email:** a transactional provider on his domain.
   - **Retention:** propose a period and a delete-on-request button in the review screen.
4. **Build in the agreed order:**
   1. Case storage and navigator sign-in (item 1).
   2. The review screen (item 4), tested on fictional families.
   3. Questionnaire to storage with consent (item 2).
   4. His content (item 3).
   5. The plan and PDF on his template (item 5).
   6. Release, link and email (item 6).
   7. The implementation request (item 7).
   8. Privacy (item 8).
   9. The acceptance run (item 9).
   10. The handover note (item 10).
5. **Keep a running tally of hours against the table above** in `chatting.md` or a `WORKLOG.md`. At US$10 an hour
   there is no slack, so flag scope changes when they happen.

## Files in this folder

| File | What it is |
| --- | --- |
| `CLAUDE.md` | The working rules for Claude Code (read automatically when the repository is opened). |
| `README.md` | How to set up this repository on a new computer, and what access is needed. |
| `deliverables/` | Files for the client: the pre-filled content spreadsheet (sent 2026-10-01). |
| `deploy-pilot/` | Staging deployment: `deploy.sh`, the Vercel project link. No secrets: those are in Vercel. |
| `IMPLEMENTATION-PLAN.md` | How the pilot is built: design decisions, routes, tables, content model, and every line of the 56 hours split into steps with a "done when". Start here before coding. |
| `WORKLOG.md` | Hours per line, the day plan, and every session logged. |
| `chatting.md` | The full client conversation, sections 1 to 17: verbatim messages, analysis, what was sent, the Upwork memos. |
| `pilot-scope-v2.txt` | His "Bare Minimum Pilot" document: the scope basis. |
| `Proposal.md` | The original Upwork bid (2026-09-22). |
| `Reply-draft.md` | An early reply draft (history only). |
| `Business_Plan.pptx` | The deck sent with the bid. |
| `client-files/` | His original brief PDF, the requirement and brief texts, his test plan PDF, and the full-build document (`Build Plan - Ageing Navigator.pdf`, text copy `build-plan-full-build.txt`). |
| `demo/` | The pilot's code (Next.js app, tests, content, scripts); see `demo/README.md`. |

## Conversation timeline (details in `chatting.md`)

1. **Sept 22:** the bid, with the prototype.
2. **Sept 24:** his brief and the path chooser discussed; he said "your original build is exactly what I'm wanting".
3. **Sept 28:** he proposed US$10/h for the MVP and US$12/h after, and asked for milestone hours. We sent 154 hours.
4. **Sept 29:** "strip this right back", with `pilot-scope-v2`. We sent 52 hours, then the review-before-release
   follow-up.
5. **Sept 29:** he proposed Google Forms, Sheet and AI drafting as a cheaper route. We offered US$300 fixed on Google
   Apps Script with OpenAI, and clarified that a ChatGPT subscription is not an API account.
6. **Sept 29:** he asked why not the fast original prototype, and asked for a video call. The user declined the call
   and we sent option A against option B in writing.
7. **Sept 30:** he asked to use the prototype as the MVP. We said yes, that is the 52 hours, US$520 fixed.
8. **Sept 30:** he approved the 52-hour plan and sent an offer (hourly, US$10).
9. **Sept 30:** he confirmed the start and sent the full-build document with two NZ$99 paid tools, to come after
   the pilot.
