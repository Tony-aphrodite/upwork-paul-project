ACTION PLAN
I built a working first version against your brief so you can judge the approach directly: https://9-22-finfield-action.vercel.app (password is on the sign-in page, all seven families are fictional).
Stack: Next.js and TypeScript, Zod schemas exported as JSON Schema, Postgres in production, and HTML/CSS rendered to PDF with headless Chromium. The Action Plan is its own versioned record where every action has a stable key, priority, owner and status, and the full plan and the Professional Summary are both just views of it.
Modules are data with declarative conditions, so one that does not apply never appears and new ones need no code. Templates skip empty sections and use paged-media CSS for footers and page breaks; tests render every case, including a long-content one, and check page counts and overflow.
Regenerating after a change carries status and notes forward by key, retires actions no longer needed, and records what changed in each version.
For structured AI output, https://9-20-ai-sponsorship.vercel.app runs eight connected agents whose outputs are schema-checked and approved before use, and this console validates AI-suggested actions the same way.
Stages: architecture and schema sign-off, engine and modules, templates, storage and versions with security, then handover docs.
Which of the six test scenarios matters most to you to get right first?
Valdis Licis

---

Screening question: Please list any certifications related to this project

I do not hold a formal certification specific to this kind of system, so rather than list unrelated ones I would point you to evidence you can check yourself. The demo applies the standards that matter most here: privacy by design with the New Zealand Privacy Act 2020 and the Health Information Privacy Code in mind (protected admin access, no family data in logs or on public pages, documents generated in memory and never stored), WCAG 2.2 AA colour contrast with tagged, screen-reader friendly PDFs, and OWASP practices such as signed sessions, rate-limited sign-in and escaping of all data in documents. Each of these is covered by the automated tests in the repository, and I am happy to walk through any of them on a call.
