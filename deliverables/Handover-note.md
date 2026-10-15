# Handover note

Ageing Navigator pilot · Version 3 · 15 October 2026

This note sums up what the pilot is, where everything lives, how to run it day to day, and what is left before the
first real family. The Navigator guide explains the screens; the Privacy facts sheet explains how information is
handled.

## What the pilot does

1. A family starts from your website (ageingnavigator.com) or a link you give an organisation. They choose one of 8
   cards ("What has brought you here?"), agree to the consent wording, and answer only the questions that apply.
2. Their Family Ageing Action Plan is built at once from your approved wording. It is shown on the thank-you page and
   emailed to them as a private link. There is no review step.
3. You are emailed for every new plan, and for urgent answers with "URGENT" in the subject. You can open any plan,
   change it and send an updated version.
4. Each plan ends with useful contacts from your list of organisations: the ones that go with its actions.
5. From their plan, the family can download a PDF, ask Ageing Navigator to help coordinate their next steps (free for
   the first 10 families), and say whether the plan was useful.
6. You export the results as a spreadsheet (CSV) for the pilot evaluation.

## Where everything lives

| What | Where | Owner |
| --- | --- | --- |
| The questionnaire | https://plan.ageingnavigator.com/start | — |
| Your sign-in | https://plan.ageingnavigator.com/login (paul@ageingnavigator.com) | you |
| Database | Supabase, project in Sydney | your account |
| Email sending | Resend, domain ageingnavigator.com (verified) | your account |
| DNS | Hostinger: four records for the address and email | your account |
| Website and app hosting | Vercel | Valdis's account for now; it can move to yours |
| Content (questions and wording) | The content spreadsheet | you edit, Valdis imports |

## Links for organisations

Give each organisation its own link, so you can see where families come from. For example:
`https://plan.ageingnavigator.com/start?ref=tauranga-hospital`.
- **The name:** any short name of lower-case letters, numbers and hyphens.
- **Where it shows:** on each case ("via tauranga-hospital") and in the CSV export.
- **Use the direct link:** a family who first goes to ageingnavigator.com and clicks a card there counts as
  "website". Give organisations the direct link, or a QR code of it.

Your website's 8 cards each have their own link, sent separately, so a family who clicks a card on your site starts
with that reason already chosen.

## Day to day

- **Read the new-plan emails:** open urgent cases first. They are listed first until opened.
- **Coordination requests:** mark them Contacted, then Closed. The counts feed the pilot results.
- **Updating the care home list or the useful contacts:** edit the "BOP Care Homes" or "Organisations" tab of your
  Repository sheet and ask Valdis to re-import it. It takes a few minutes.
- **Changing wording:**
  1. edit the content spreadsheet and send it to Valdis;
  2. it is checked and imported;
  3. plans already sent keep their wording, and "Regenerate from answers" rebuilds a plan with the new wording.
- **"Free for the first 10 families":** the wording is in the spreadsheet (Texts tab). Change it when the offer ends.
- **Deleting a family's information:** open the case and use "Delete this case now".
- **Automatic deletion:** cases are deleted 12 months after the plan was sent.

## Before the first real family

| Step | Who | Status |
| --- | --- | --- |
| DNS records and email domain | you, with Valdis | done 13 October |
| Emails tested on the real address | Valdis | done 14 October |
| Approve the wording ("approved as it is", or changes in the spreadsheet) | you | waiting |
| Turn on approved-only mode, so only approved wording can ever be sent | Valdis | after your approval |
| Daily backups: upgrade the Supabase project to Pro | you | waiting |
| Remove the test cases and the test account | Valdis or you, with the prepared script | at launch |
| Change the password shared for Supabase and Resend, and turn on two-step sign-in | you | at launch |
| Point your website's buttons and cards to the questionnaire links | you | when ready |

## Known limits of the pilot

- **One region:** Bay of Plenty only.
- **Care homes only:** when residential care comes up, the plan lists up to 3 care homes from your Repository sheet
  (added 15 October).
  - Villages and home care providers are not matched yet.
  - Your list's "Website / Contact" column is empty, so the plan shows each home's address. Filling in a phone number
    or website lets the plan show it.
- **Useful contacts:** the 15 organisations in your Organisations tab.
  - Stroke Aotearoa and Parkinson's New Zealand are not shown yet, because no question asks about stroke or
    Parkinson's.
  - Rotorua families see only the national organisations. "Bay of Plenty" in the coverage column is read as Health
    NZ's Bay of Plenty district, which does not include Rotorua. Add "Rotorua" to an organisation's coverage when it
    serves Rotorua too.
- **"They" wording:** the questions speak about another person. A "you" version for people planning for themselves is
  for the full build.
- **Questionnaire version 2.1** (modules, respite and EPOA modules, paid tools) is set aside until after the pilot.
- **Technical access:** Valdis keeps technical access to the hosting and database during the pilot, to maintain them.

## After the pilot

- **A summary for organisations:** the pilot records which families explored villages or residential care, their
  preferred areas and what mattered to them. That can become an anonymised summary to show villages and care
  providers.
- **The full build:** the decision rests on the pilot's results. Do families finish, do they find the plan useful, and
  do some ask for help coordinating?
