# Ageing Navigator pilot (Kinfield prototype), New Zealand

A won Upwork job. The user works on Upwork as **Valdis Licis** and builds the Ageing Navigator pilot for the founder
of Ageing Navigator, a New Zealand service for families of older people. This repository holds everything needed to
carry on:
- the code: `demo/`;
- the project notes;
- the client log: `chatting.md`;
- the client's documents;
- the rules below.

**Start every new session here:**
1. `HANDOFF.md`: status, scope, terms, constraints.
2. The last sections of `chatting.md`.
3. `IMPLEMENTATION-PLAN.md` section 0, for what is built and what waits.
4. `WORKLOG.md`, for the hours and the day plan.

@HANDOFF.md

## Who you work for

- **Language:** the user writes in Korean. **Reply to the user in Korean.**
- **Signature:** every message to the client is signed "Valdis".
- **Every file is in English with zero Korean characters.** This covers code, notes, `chatting.md`, client
  messages, commit messages, documents and spreadsheets. Before finishing, grep the files you touched:
  `grep -rnP '[\x{AC00}-\x{D7A3}\x{3130}-\x{318F}]' <files>`.
- **No camera:** the user never appears on camera, and takes no video calls with this client. Offer written answers
  or captioned screen recordings instead.
- **Keep it short when the user asks for short.** Do not ask questions that a sensible default answers.

## Client messages

When the user pastes a client message, append the next numbered section to `chatting.md`, containing:
- the client's message, verbatim, as a quote;
- an analysis in English;
- a ready-to-send reply in English, signed Valdis;
- prep notes when needed.

Then give the user a short summary in Korean, with the reply in a code block. Messages we send without a client
message first (updates, requests) get a section too, marked sent once the user confirms.

- **Read the log first.** A reply must never contradict what was already sent.
- **Client ready to start or confirm: no question at the end.** State open points as decisions ("a small change if
  you want it different") and end with the next step.
- **Never invent** experience, clients or certifications.
- **Never quote a price or rate** the user has not agreed.
- **Upwork rules:**
  - Payments and milestones stay on Upwork.
  - With the contract active, sharing email addresses and account invites is fine.
  - Never suggest account sharing.

## Time on Upwork

- **Contract and plan:** hourly at US$10. The plan is 56 hours, split into lines in `WORKLOG.md`. Log every session
  there against a line. Anything outside the plan is new work: state it in hours, never absorb it quietly.
- **Memos are at most 140 characters each.** Count them with code before handing them over. A memo describes only
  the work actually done in that tracked slot. Record the final memos in `chatting.md`.
- **Day plan:** days 4 to 8, with hours set by the user and a memo draft per slot, are in `WORKLOG.md`. Before
  writing a day's memos, check what was actually done that day and rewrite the drafts to match.

## Git

- **Never `git push` without the user's explicit approval for that push.** Approval for one push does not cover
  later ones.
- **This repository is public.** The user decided this on 2026-10-01, knowing it holds the client's conversation
  and documents. Because anyone can read it:
  - **never commit** secrets, `.env` files, database addresses, real families' data, or anything the client marks
    confidential;
  - before every commit, check the staged files for tokens, keys and connection strings.
  - If the code alone has to be handed over, give `demo/` only, for example with `git subtree split --prefix=demo`.
- **Commits:** only when asked, or when the task clearly includes it. Messages are in English and end with the
  co-author trailer the session provides.

## Engineering habits

- **Verify before claiming.**
  - Tests: `cd demo && npm test`; with Chrome, `CHROME_PATH=/usr/bin/google-chrome npm test`.
  - Real Postgres: `TEST_DATABASE_URL=postgres://…@127.0.0.1:…/postgres npm test`, against a local server only.
  - Type check and build: `npx tsc --noEmit` and `npx next build`.
  - UI: open the real pages in Chrome at desktop width and at 390 px. Nothing may scroll sideways, and the console
    must show no errors. `npm run check:browser` does the whole flow; see `demo/README.md`.
- **Node 20.** Run commands from `demo/`.
- **Secrets:**
  - Never print them, and never commit `.env` files.
  - The client enters his own keys; never take a key by chat. Database addresses go in `demo/.env.local`, which
    is never committed.
  - The user runs destructive statements on hosted databases themselves.
- **Fictional data** uses the phone number `0123456789` and `@example.test` emails. Real client data is used as
  given.

## Product rules (health information about New Zealand families)

- **Scope** is the ten-line plan in `HANDOFF.md`, plus the four additions in `IMPLEMENTATION-PLAN.md` section 8.
  Paid tools, payments, matching and repositories come after the pilot.
- **Families never see an unreviewed plan.** A navigator releases every plan.
- **Data handling:**
  - no personal data in logs;
  - navigator-only access;
  - consent before the questionnaire;
  - retention and deletion from day one;
  - emails carry links, never health information.
- **No advice wording.** Never generate eligibility, care-level, clinical or financial conclusions. Write "possible
  pathway to investigate". No gendered pronouns of our own, and never a family's free text inside a sentence.
- **Content comes from the client.** It is edited in the content spreadsheet (`npm run content:export` and
  `content:import`). Families only ever see content marked Approved: set `REQUIRE_APPROVED_CONTENT=1` on production.

## Deploying to Vercel (team `servi-tec`)

- **Deploy:** `deploy-pilot/deploy.sh`. It deploys `demo/` from a git-free export, because the team blocks
  deployments whose git commit author has no Vercel account.
- **Attach a `*.vercel.app` name** with `vercel domains add <name>.vercel.app <project> --scope servi-tec`. Do not use
  `vercel alias set`, which ends up behind SSO.
- **Set secrets** with `printf '%s' "$VALUE" | vercel env add NAME production --scope servi-tec`, without echoing
  the value.
- **Location:** Vercel geolocates the original machine in Germany. Keep that in mind for region-dependent behaviour.
