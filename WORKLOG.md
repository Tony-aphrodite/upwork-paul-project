# Work log: Ageing Navigator pilot

Hourly contract at US$10 an hour. **The plan is 56 hours:** the client-approved 52-hour list, plus 4 hours of
kick-off (line 0) to review his 53-page full-build document, received 2026-09-30, and align the pilot with it. The
client calls it "the 56 hour plan" (`chatting.md` section 13). Log every session against a line; also track time in
the Upwork Time Tracker with a memo.

| # | Line (estimate) | Estimate | Logged |
| --- | --- | --- | --- |
| 0 | Kick-off: full-build document review, prototype audit, pilot structure and build order | 4 | 4 |
| 1 | Start from the prototype, remove out-of-scope parts, case storage, navigator sign-in, hosting on the subdomain | 6 | 6 |
| 2 | Questionnaire: final questions and branching, Unsure / Don't know, consent, mobile | 6 | 1 |
| 3 | Rules and approved content, plan sections, empty sections left out | 8 | 3 |
| 4 | Review screen: read, edit wording, remove an action, approve and release | 7 | 2 |
| 5 | Plan on screen and as a PDF on his template | 6 | 1 |
| 6 | On release: private link for the family and an email with it | 3 | 2 |
| 7 | Implementation request form, email to him when one arrives | 3 | 0 |
| 8 | Privacy and security: navigator-only access, retention and deletion, backups | 4 | 1 |
| 9 | Fictional-family run with him, and fixes | 8 | 0 |
| 10 | Short handover note | 1 | 0 |
| | **Plan** | **56** | **20** |
| 11 | Additions (user decision 2026-09-30): new-submission email, referral source, feedback, CSV export | 3.5 | 0 |
| | **Total with additions** | **59.5** | **20** |

Line 11 is built as part of the pilot by the user's decision; `IMPLEMENTATION-PLAN.md` section 8. Paid tools and the
rest of the full build come after the pilot.

## Day plan from day 3 (hours set by the user, 2026-10-01)

Days 1 and 2 (14 hours) are logged and posted. The user set the hours for days 3 to 8: 42 hours, so 56 in all.
They are filled with the work that genuinely remains on each line after day 3:

| Line | Hours left |
| --- | --- |
| L2 | 5 |
| L3 | 5 |
| L4 | 5 |
| L5 | 5 |
| L6 | 1 |
| L7 | 3 |
| L8 | 3 |
| L9 | 8 |
| L10 | 1 |

**Rules for the memos:**
- A memo describes the work actually done in that slot.
- If a slot's work changes, because an input is late or something else was needed, the memo is rewritten to match.
- Memos are 140 characters at most.
- Work finished before day 3 is not described again: the client was told on 2026-10-01 that the pilot is built and
  tested.

**What each day needs:**

| Day | Needs |
| --- | --- |
| 5 | The staging database (the user) |
| 6 | His completed spreadsheet, logo and colours |
| 7 | His Supabase, Resend and DNS, and his time to test |
| 8 | His test results |

| Day | Slot | Hours | Lines | Work | Memo draft |
| --- | --- | --- | --- | --- | --- |
| 3 | AM | 3 | 1 (2), 3 (1) | Staging project on Vercel with secrets and deploy script; content spreadsheet checked and cleaned | Final checks before sending: content spreadsheet cleaned up, test site set up on Vercel with secure settings and a repeatable deploy step. |
| 3 | PM | 3 | 3 (2), 6 (1) | Client message with the spreadsheet and the needs list; email status fix | Sent the content spreadsheet and what is needed to go live (accounts, domain, brand, reviewers); email now shows when it was not sent. |
| 4 | AM | 3 | 2 (3) | Keyboard-only and accessibility check of every page, with fixes | Keyboard-only and accessibility check of every page (questionnaire, plan page, review screen) with fixes for what it found. |
| 4 | PM | 5 | 4 (2), 8 (2), 6 (1) | Navigator guide; privacy facts sheet; domain and email setup guide | Navigator guide (review, edit, release, requests), privacy facts sheet for your privacy statement, and a domain and email setup guide. |
| 5 | AM | 3 | 9 (3) | Staging on its database, fictional families, full run, fixes | Test site on its own database: fictional families submitted, full run from questionnaire to released plan, fixes. |
| 5 | PM | 4 | 7 (2), 2 (1), 4 (1) | Help request and emails on staging; mobile check; review polish | Help request and navigator emails checked end to end on the test site; mobile check; review screen polish from the test run. |
| 6 | AM | 3 | 3 (3) | His spreadsheet imported and validated, problems worked through | Imported your completed content spreadsheet, checked every rule and wording, worked through the problems it found. |
| 6 | PM | 4 | 5 (3), 3 (1) | His brand in pages and PDF; plans rebuilt, tests updated | Your logo and colours on every page and in the PDF; fictional plans rebuilt with your content and tests updated. |
| 7 | AM | 3 | 8 (1), 7 (1), 5 (1) | His database, backups, restore test; his email domain and DNS; PDF refinements | Your own database, backups and a restore test; email from your domain and the DNS records; PDF template refinements. |
| 7 | PM | 4 | 9 (3), 3 (1) | Fictional-family run with him; his wording changes | Fictional-family run with you, and your round of wording changes applied. |
| 8 | AM | 3 | 4 (2), 5 (1) | Fixes from his run; final PDF and brand check | Fixes from your test run on the review screen and plan; final check of the PDF and branding. |
| 8 | PM | 4 | 9 (2), 2 (1), 10 (1) | Go-live on his subdomain; final mobile check; handover note | Go-live on your subdomain: navigator accounts, test data removed, final mobile check; handover note. |
| | | **42** | | | |

## Sessions

| Date | Line | Hours | What was done |
| --- | --- | --- | --- |
| 2026-09-30 (morning) | 0 | 1 | Project kick-off: workspace, notes and time log set up; pilot scope and order of work confirmed |
| 2026-09-30 (afternoon) | 0 | 3 | Full review of the 53-page build document; its 34 deliverables mapped to the prototype, the pilot and the full build (`chatting.md` section 13) |
| 2026-09-30 (afternoon) | 1 | 2 | Prototype audit against the pilot: storage, sign-in, review screen, family flow; pilot structure planned (question configuration, case record, plan sections, sources on wording) |
| 2026-10-01 (morning) | 1 | 2 | Case storage (Postgres, Sydney), navigator accounts and sign-in, out-of-scope demo parts removed |
| 2026-10-01 (morning) | 2 | 1 | Questionnaire saves to the server, with consent first and urgent guidance on the thank-you page |
| 2026-10-01 (afternoon) | 4 | 2 | Review screen: edit any wording, remove and restore, preview, approve and release |
| 2026-10-01 (afternoon) | 5 | 1 | Plan on screen and as a PDF from one renderer |
| 2026-10-01 (afternoon) | 6 | 1 | Private family link and release email |
| 2026-10-01 (afternoon) | 8 | 1 | Full code review (frontend, backend, database, engine), security fixes, tests on a real Postgres |
| 2026-10-02 (morning, day 3) | 1 | 2 | Staging set up on Vercel (project ageing-navigator-pilot, secrets, deploy script); waits for the staging database |
| 2026-10-02 (morning, day 3) | 3 | 1 | Content spreadsheet checked and cleaned for sending (no non-Latin text), round trip verified |
| 2026-10-02 (afternoon, day 3) | 3 | 2 | Client message: content spreadsheet, four content decisions, accounts, domain, brand, reviewers (`chatting.md` section 15) |
| 2026-10-02 (afternoon, day 3) | 6 | 1 | Release email reports "not sent" where no email service is set, so navigators copy the link instead |

## Build status

On 2026-10-01 the code for most lines was written and verified locally; see `IMPLEMENTATION-PLAN.md` section 0.
Hours are logged by the user from the Upwork Time Tracker; the line split above is the user's allocation of
tracked time, not a measure of what is built. The code is ahead of the logged hours:
- lines 1 to 8 and 11 are built and tested;
- the hours left on them cover the work that needs the client: his content (3d), his brand (5b), DNS and email
  (6c), backups (8c), staging and go-live (1e, 9d);
- his test run (9c) and the handover (10) come after that.

The client was sent the content spreadsheet and the list of what is needed from him on 2026-10-01 (`chatting.md`
section 15).

