# Navigator guide

Ageing Navigator pilot · Version 1 · 12 October 2026

This guide is for the people who review and release Family Ageing Action Plans. It covers signing in, reviewing,
releasing, help requests, urgent cases and deleting a case.

## How the pilot works

1. A family answers the questionnaire. They agree to the consent wording first, and see only the questions that
   apply to them.
2. Their plan is built straight away from your approved wording. The family does **not** see it yet. You get an email
   with the case reference.
3. You read the plan, change any wording, remove anything that does not fit, and release it.
4. The family gets an email with a private link to their plan. From there they can download it as a PDF, ask you for
   help, and say whether it was useful.

A family never sees a plan that a navigator has not released.

## Signing in

- **Where:**
  - https://plan.ageingnavigator.com/login, once your domain records are in place;
  - until then, https://ageing-navigator-pilot.vercel.app/login.
- **The first time:** you receive a private setup link.
  - It works once, for 48 hours.
  - You choose your own password, of 12 characters or more. Nobody else ever sees it.
- **Staying signed in:** a session lasts 8 hours; then you sign in again.
- **Forgotten password, a new reviewer, or a reviewer who leaves:** ask Valdis.
  - A new setup link replaces the old password. Every open session for that account ends at once.
  - Removing an account takes effect immediately.
- **On a shared computer,** use Sign out at the top right when you finish.

## The case list

After signing in you see **Cases**:

| Tab | What it shows |
| --- | --- |
| To review | Cases waiting for you. Urgent cases are listed first. |
| Released | Plans already sent to the family. |
| Closed | Cases you have filed away. |
| All | Everything. |

**Labels on a case:**
- **New:** not opened yet.
- **Urgent:** the family reported something that may need urgent attention; see "Urgent cases" below.
- **Help requested:** the family has asked for help and it is still open.

**Emails you receive:**
- **When a family sends their answers:** "New questionnaire AN-XXXXXX", or "URGENT: new questionnaire AN-XXXXXX".
- **When a family asks for help:** "Implementation request AN-XXXXXX".

These emails carry only the reference, never the family's answers. Sign in to read the case.

## Reviewing a plan

Open a case from the list. The top shows:
- the reference and the status;
- the family's contact details;
- when the case was submitted;
- the date it will be kept until.

The case has three tabs:
- **Plan:** the plan you are editing.
- **Answers:** the family's answers, read only.
- **Requests and feedback:** anything the family sent after the plan was released.

**In the Plan tab you can:**
- change the wording of any section;
- **Remove** an item that does not fit. It stays on screen, struck through, and **Restore** brings it back;
- change an action's priority: Now, Soon or Plan ahead;
- write an **Internal note**. It is for the team only and is never shown to the family.

**Buttons along the bottom:**
- **Save changes:**
  - Saves your edits.
  - If someone else saved the same case in the meantime, you are asked to reload. Nothing is overwritten silently.
- **Preview:** shows the plan exactly as the family will see it on screen.
- **PDF preview:** downloads the PDF as the family will receive it. Save your changes first.

**Regenerate from answers:**
- **What it does:** rebuilds the plan from the family's answers with the current wording, which is useful after the
  content has been updated.
- **What you lose:** your edits to the plan you are working on.
- **What stays:** a plan already released to the family does not change.

**Keep to the service's wording.** Plans describe possible pathways to investigate. Do not add eligibility decisions,
care levels, clinical conclusions or financial advice. Those come from assessors and professional advisers, and the
plan says so.

## Releasing a plan

1. Press **Approve and release**, then **Yes, release**.
2. The plan as it stands becomes the family's plan, and the family is emailed a private link.
3. The link is also shown on screen once. Use **Copy link** if you want to send it yourself, for example by text.

**If the screen says the email was not sent,** copy the link from the screen and send it yourself, or use
**Email a new link** later. Until email is switched on for your domain, every release works this way.

**To change a plan after release:** edit it, save, and press **Release again**. The family is sent a new link, and
the old link stops working.

**New link to copy** makes a fresh link without changing the plan, for example when a family has lost their email.
The old link stops working.

**What the family sees:**
- their plan;
- a button to download the PDF;
- a form to ask for help;
- a short feedback form.

The PDF carries no link, so a forwarded PDF opens nothing. While any content row is still marked Draft, plans and
PDFs say "Test version".

## Help requests and feedback

- **When a family asks for help:**
  - you receive an email;
  - the case shows **Help requested**;
  - the **Requests and feedback** tab shows the services they chose, how and when to contact them, and anything they
    added.
- **Request status:** **New**, then **Contacted**, then **Closed**. Keep it up to date: the counts feed the pilot's
  results.
- **Feedback:** whether the plan was useful, whether it made sense, what was missing, and whether they would like
  help.

## Urgent cases

**When a case is urgent:** the family answered Yes or Possibly to "Do you believe anything may currently require
urgent attention?", or named a concern. Examples of concerns: recent falls, a hospital discharge without enough
support, a carer who can no longer cope.

**What happens straight away:**
- The family is shown emergency guidance on the thank-you page: call 111 if anyone is in danger, Healthline for
  health advice, and do not wait for the plan.
- You receive an email whose subject starts with "URGENT".

**Check the list every day.** The pilot does not phone anyone or escalate by itself. If email is not working, the
case list is the only place an urgent case shows up.

## Closing and deleting cases, and how long they are kept

- **Close case:** files the case away.
  - It can no longer be edited, and **Reopen** brings it back.
  - The family's link keeps working.
- **Delete this case now:** removes the case at once.
  - What goes: the answers, the plan, requests, feedback and the family's link.
  - Type the reference to confirm. This cannot be undone.
  - Use it when a family asks you to delete their information.
- **Automatic deletion** runs every day:
  - a released case is deleted 12 months after release;
  - a case that was never released is deleted 60 days after it was submitted.

  Each case shows its "kept until" date.

## Exporting for the pilot evaluation

**Export CSV**, at the top of every page, downloads one row per case.
- **What it holds:** dates, status, pathways, choice answers, request and feedback summaries.
- **What it leaves out:** names, contact details and anything the family typed in their own words.

It still describes families' situations, so store it securely and do not email it around. Each export is recorded.

## Changing the questions and wording

- **Where the content lives:** questions, branching, actions and texts are all in the content spreadsheet.
- **How to change it:**
  1. Change the wording there and mark each row Approved.
  2. Send the spreadsheet to Valdis.
  3. He imports it, checks every rule and publishes it.
- **Plans already made** keep their wording. Use Regenerate from answers on a case to rebuild it with the new
  wording.
- **Approved content only:** real families see only approved content. Until every row is approved, plans are marked
  "Test version".

## If something goes wrong

| Problem | What to do |
| --- | --- |
| You cannot sign in | Ask Valdis for a new setup link. |
| The family did not get the email | Ask them to check their spam folder, or use New link to copy and send it yourself. |
| The family's link does not work | It may have been replaced or expired. Make a new link and send it. |
| Anything else | Message Valdis with the case reference. Never send a family's details or answers by message. |
