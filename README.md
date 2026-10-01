# Ageing Navigator pilot: working repository

This repository holds the code, our working notes, a client's conversation and his documents. It is public by the
user's decision (2026-10-01). Because anyone can read it, never commit secrets, `.env` files, database addresses or
real families' data; see `CLAUDE.md`.

## What is here

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | The working rules. Claude Code reads it automatically when this folder is opened. |
| `HANDOFF.md` | Where the project stands: client, scope, terms, status, next steps. **Read first.** |
| `IMPLEMENTATION-PLAN.md` | How the pilot is built, step by step; section 0 says what is done and what waits. |
| `WORKLOG.md` | Hours per plan line, the day plan with Upwork memo drafts, every session logged. |
| `chatting.md` | Every client message and our replies, numbered, with analysis. |
| `client-files/` | The client's briefs and documents. |
| `deliverables/` | Files sent to the client (the content spreadsheet). |
| `deploy-pilot/` | Staging deployment script and Vercel link (no secrets). |
| `demo/` | The pilot app: Next.js, tests, content, scripts. Its own `README.md` has the technical detail. |
| `pilot-scope-v2.txt`, `Proposal.md`, `Reply-draft.md`, `Business_Plan.pptx` | The scope document and the history of the bid. |

## Set up on a new computer

1. **Install:**
   - git and Node.js 20;
   - Google Chrome, for the PDFs and the browser check;
   - optionally PostgreSQL 16, to run the tests on a real database;
   - the Vercel CLI (`npm i -g vercel`), only if you will deploy.
2. **Get the code and run the tests:**
   ```bash
   git clone <this repository> ageing-navigator && cd ageing-navigator/demo
   npm install
   npm test                                            # PGlite, no database needed
   CHROME_PATH=/usr/bin/google-chrome npm test         # adds the PDF tests (adjust the Chrome path on Mac or Windows)
   ```
3. **Run it locally:**
   ```bash
   npm run navigator -- --email you@example.test --name "You"   # prints a one-time setup link
   npm run dev                                                   # http://localhost:3000; open the setup link
   ```
4. **Work with Claude Code.** Open the repository root (not `demo/`), so `CLAUDE.md` is read. A good first prompt:
   "Read HANDOFF.md and the last sections of chatting.md, then tell me what is next."

## Access that is not in the repository

Ask the user for these. Never put them in files that are committed, and never send them by chat:
- **Vercel:** membership of the team `servi-tec`, to deploy and to manage the environment variables.
- **Staging database:** the address goes in `demo/.env.local` as `DATABASE_URL=…`. This file is ignored by git.
- **Later:** the client's Supabase and Resend accounts, by invitation from him.

## Checking and deploying

- `cd demo && npm test`, `npx tsc --noEmit` and `npx next build` before every commit that changes code.
- `npm run check:browser` checks the whole flow in Chrome at desktop width and at 390 px. Run it against a local or
  staging app; see `demo/README.md`.
- `deploy-pilot/deploy.sh` deploys the committed `demo/` to https://ageing-navigator-pilot.vercel.app.
- `git push` only with the user's approval.
