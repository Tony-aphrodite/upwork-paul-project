# Privacy facts for your privacy statement

Ageing Navigator pilot · Version 3 · 15 October 2026

**What this is:** the facts of how the pilot handles personal information. Use it to write your privacy statement,
to answer families' questions, and to brief anyone who reviews the service.

**What it is not:** legal advice. The pilot holds health information about New Zealanders, so the Privacy Act 2020
and the Health Information Privacy Code 2020 apply. The Privacy Commissioner's guidance at privacy.org.nz, or a
privacy adviser, can confirm what your statement needs.

## What the pilot collects

**From the family, in the questionnaire:**
- their answers, mostly as choices: an approximate age band, and health, care, living and money circumstances;
- the older person's first name, and preferred name if given;
- the name, email address and, optionally, phone number of the person filling it in;
- how they heard about Ageing Navigator, if given;
- when they agreed to the consent wording, and whether they opted in to news.

**Later, if the family uses their plan page:**
- a coordination request: the services they want help with, how and when to contact them, and an optional note;
- feedback on the plan.

**Not collected:**
- dates of birth (only an age band);
- payment details;
- documents;
- IP addresses, which the app does not store;
- advertising or analytics cookies, which the app does not use.

## Why it is used

- to build the family's plan from your approved wording;
- to send it to the family as soon as they finish (there is no review step before sending; a navigator can still
  check it and send an updated version);
- to send the family their private link;
- to respond to their coordination request;
- to evaluate the pilot, through an export without names, contact details or free text;
- to send news, only if they opted in.

## The consent families agree to

Shown after the family chooses what has brought them here and before the first question, with a tick box that must
be ticked:

> Your information is stored securely in Australia, kept for up to 12 months, and won't be shared with other
> organisations without your permission. Read our Privacy Policy.
>
> I agree, and I have the older person's agreement or am acting in their interests.

This is your wording of 15 October. "Read our Privacy Policy" links to the policy at
https://plan.ageingnavigator.com/privacy, which says the rest: what is collected, why, who sees it, the services used,
no AI, and how to ask for access, correction or deletion. The news opt-in is a separate, optional tick box.

## Where the information is held, and which services process it

| Service | What it does | Where | What it receives |
| --- | --- | --- | --- |
| Supabase (database), in your account | Stores cases, answers, plans, requests and feedback | Sydney, Australia | Everything listed above |
| Vercel (website and app) | Runs the pages and the code that handles answers | The code runs in Sydney; pages are delivered through Vercel's global network | Answers pass through it on their way to the database; the app keeps no copy |
| Resend (email), in your account | Sends the emails | Sending region Tokyo | The recipient's address, the subject and the email text: a link or a case reference, never answers |
| The family's own browser | Keeps their answers while they fill in the questionnaire | Their device | Their own answers, until they send them or press Start again |

**Points to know:**
- **No AI service** receives any information.
- **Supabase, Vercel and Resend are United States companies.**
  - The database itself is in Sydney.
  - Each service keeps short-lived technical logs under its own terms. Vercel's request logs, for example, include
    IP addresses.
  - Resend keeps a copy of each sent email in your Resend dashboard for a period, including the family's private
    link. Only people with access to your Resend account can see it.
- **The answers saved in the browser** stay on that device until the family sends them or presses **Start again**.
  On a shared computer they should do one or the other before leaving.
- **Two things for now, during the pilot:**
  - **The developer's accounts:** the website runs in the developer's Vercel account, and it can move to an account
    in your name.
  - **Technical access:** Valdis, the developer, has technical access to the hosting and database in order to
    build and maintain the service. If your statement says answers are "seen only by the Ageing Navigator team",
    consider mentioning contractors who work on the service for you.

## Who can see a family's information

- **Navigators:** only people with a navigator account, which today means you.
  - Each navigator signs in with their own password.
  - Sessions end after 8 hours.
  - Removing an account ends its access at once.
- **The family:** only through their private link.
  - The link holds a long random code. The database keeps only a fingerprint of it, so the link cannot be read back
    from the database.
  - The link stops working when a new link is sent, when the case is deleted, or when the retention period ends.
  - The PDF carries no link, so a forwarded PDF opens nothing.
- **Emails** never contain health information. Navigators' emails carry only the case reference.

## Security measures in the pilot

- **Encryption:** every connection is encrypted (HTTPS), including the app's connection to the database.
- **No direct access to the database:**
  - It is reachable only from the app's server, never from a browser.
  - Row-level security is on for every table with no access rules, so the database provider's public interface
    returns nothing.
  - Supabase states that it encrypts stored data.
- **The navigator area:**
  - every page and action checks the navigator's session;
  - changes are accepted only from the site itself;
  - repeated failed sign-ins are slowed down.
- **The app's own logs:** they hold no personal information. Limits on repeated submissions use a scrambled
  ("hashed") form of the connection, not the IP address.
- **Backups:** there are none yet, on the free plan.
  - Supabase's paid Pro plan adds daily backups. We recommend it before real families.
  - With backups on, a deleted case remains in the backups until they expire. Supabase currently states 7 days on
    Pro.

## How long information is kept

- **Released plans:** the case is deleted 12 months after the plan is released, as the consent wording says.
- **Plans never released:** deleted 60 days after the questionnaire was sent.
- **On request:** a navigator can delete a case at once (Delete this case now).
- **Automatic deletion** runs every day.
- **What remains after deletion:** anonymous counts of events (for example "a plan was released"), with no link to a
  person.

## Requests from families

- **To see their information:**
  - the navigator can read every answer in the case's Answers tab, and the plan;
  - there is no self-service download of answers;
  - the navigator can send the family their plan link, or a summary of the answers.
- **To correct it:**
  - answers are not edited after they are sent;
  - the navigator can correct the plan's wording;
  - for answers, the family can fill in the questionnaire again, and the old case can be deleted.
- **To delete it:** Delete this case now, in the case.
- **To stop news:**
  - the opt-in is recorded on the case;
  - the pilot keeps no mailing list of its own, so any newsletter tool you use later handles unsubscribes separately.

## Points for you to decide or do

1. **Privacy officer:** every agency must have one under the Privacy Act. Name yours in the statement.
2. **Privacy policy:** a draft written from these facts is live at https://plan.ageingnavigator.com/privacy, marked
   "Draft" until you approve it. The consent wording and the footer of every family page link to it. To publish it on
   ageingnavigator.com instead, copy the text there and send Valdis the address.
3. **Backups:** turn on Supabase Pro before the first real family.
4. **Accounts:**
   - change the shared password for Supabase and Resend once testing ends;
   - turn on two-step sign-in for both.
5. **Home Carers:** your brand guide asks for the ownership relationship with Home Carers to be explained where
   relevant. If answers or requests might ever be shared with Home Carers, the consent wording promises to ask the
   family first; your statement should say how.
6. **Breaches:** a privacy breach likely to cause serious harm must be notified to the Privacy Commissioner and to the
   people affected. If you suspect one, tell Valdis at once, so access can be closed and what happened can be traced.
