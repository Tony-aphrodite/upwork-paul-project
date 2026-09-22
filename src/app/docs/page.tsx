import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";

export const metadata: Metadata = { title: "Technical documentation" };

const TOC: [string, string][] = [["architecture", "Recommended architecture"], ["questionnaire", "The questionnaire"], ["data", "Data model"], ["pilot", "Running the pilot"], ["modules", "Conditional modules"], ["versions", "Versions and the living plan"], ["pdf", "Document generation"], ["api", "API"], ["security", "Security and privacy"], ["integration", "Future integration"], ["stages", "MVP stages"]];

const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="scroll-mt-24 border-t border-line pt-10 text-[23px]">{children}</h2>;
const Code = ({ children }: { children: string }) => <pre className="code mt-3 overflow-x-auto">{children}</pre>;
const T = ({ head, rows }: { head: string[]; rows: string[][] }) => (
  <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
    <table className="w-full min-w-[640px] text-[14px]"><thead className="border-b border-line bg-brand-soft/60"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "td font-mono text-[13px] font-semibold" : "td"}>{c}</td>)}</tr>)}</tbody></table>
  </div>
);

export default function Docs() {
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
        <p className="eyebrow">On this page</p>
        <ol className="mt-2 space-y-1.5 text-[14px]">{TOC.map(([id, t]) => <li key={id}><a href={`#${id}`} className="text-muted hover:text-brand">{t}</a></li>)}</ol>
      </nav>
      <article className="min-w-0 max-w-3xl space-y-4 text-[15px] leading-relaxed">
        <p className="eyebrow">Technical documentation</p>
        <h1 className="text-[32px] leading-tight">How the Action Plan system is built, and how it grows</h1>
        <p className="text-muted">Written for the team that will connect the questionnaire, AI, knowledge repository and dashboards later. The principle throughout: the plan is structured data; documents are views of it.</p>

        <H id="architecture">Recommended architecture</H>
        <p>The simplest thing that scales: one TypeScript codebase with a pure plan engine, Postgres for data, object storage for documents, and headless Chromium for PDFs.</p>
        <div className="mt-4 grid gap-2 text-center text-[14px] font-semibold">
          {[["Questionnaire", "conditional questions, held as content"], ["Profile mapper", "answers → Family Profile (validated)"], ["Plan engine", "profile + module library + previous version → Action Plan"], ["Plan store", "immutable versions, actions table for reminders and dashboards"], ["Document service", "Action Plan → HTML/CSS template → PDF"], ["Secure storage", "encrypted PDFs, short-lived signed links"]].map(([t, d], i, a) => (
            <div key={t}><div className="rounded-xl border border-line bg-white p-3"><span className="text-brand">{t}</span><span className="block text-[13px] font-normal text-muted">{d}</span></div>{i < a.length - 1 && <ArrowDown size={16} className="mx-auto mt-2 text-muted" aria-hidden="true" />}</div>
          ))}
        </div>
        <T head={["Layer", "Choice", "Why"]} rows={[
          ["Language", "TypeScript end to end", "One set of types for API, engine, templates and admin UI"],
          ["Contracts", "Zod, exported as JSON Schema", "The same definitions validate input at runtime and document it for other teams"],
          ["Engine", "Pure functions, no I/O", "Testable, deterministic, runs in the browser for previews and on the server"],
          ["Database", "Postgres (JSONB plus a few relational tables)", "Flexible profile fields without migrations for every new question; SQL for reporting"],
          ["Documents", "HTML/CSS template, headless Chromium", "Designers can change the look with CSS; paged-media CSS handles breaks and footers"],
          ["Hosting", "Vercel or any Node host; Chromium via @sparticuz/chromium or a container", "The demo runs on Vercel; a container is a drop-in swap if PDF volume grows"],
        ]} />
        <p className="text-[14px] text-muted">In this demo there is no database: the test console keeps fictional plans in the browser, and the server is stateless. The storage interface is the only piece that changes for production.</p>

        <H id="questionnaire">The questionnaire</H>
        <p>The questions are content, in <code className="font-mono">content/questionnaire.json</code>, validated on load against the <a className="font-semibold text-brand underline" href="/api/schemas/questionnaire">Questionnaire schema</a>. Sections and questions carry the same declarative <code className="font-mono">when</code> conditions the plan modules use, read over the answers instead of the profile, which is how &ldquo;you will only be shown questions that are relevant to you&rdquo; works without any branching code.</p>
        <T head={["Piece", "Where", "Why it is separate"]} rows={[
          ["Questions", "content/questionnaire.json", "Reword, reorder or add a question without a release; the version is stamped on every plan"],
          ["Branching", "when conditions on sections and questions", "Five conditional sections today: hospital, memory, funding, village, residential care"],
          ["Mapping", "src/lib/questionnaire/map.ts", "Answers to Family Profile in one place, so either side can change alone"],
          ["Validation", "src/lib/questionnaire/logic.ts", "Required answers, choose-up-to-three and grid rows, used by the form and the API"],
        ]} />
        <p>The mapping records what it worked out from other answers and what the questionnaire never asked, and both are shown to the family and the navigator. Every raw answer is kept on the profile, so a profile can be re-derived when the mapping improves. Changing a question does not invalidate old plans: they keep the version they were made from.</p>
        <p className="text-[14px] text-muted">The public routes under <code className="font-mono">/api/questionnaire/</code> store nothing. Answers arrive with the request, the plan and the PDF are returned to that browser, and in the pilot a navigator reviews the plan before it is sent.</p>

        <H id="data">Data model</H>
        <p>Three contracts, each with a JSON Schema: <a className="font-semibold text-brand underline" href="/api/schemas/family-profile">Family Profile</a>, <a className="font-semibold text-brand underline" href="/api/schemas/action-plan">Action Plan</a> and <a className="font-semibold text-brand underline" href="/api/schemas/module-definition">Module definition</a>.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Family Profile</strong>: grouped sections (person, living, support, mobility, health, cognition, hospital, home safety, funding, legal, transport, social, respite, future, goals). Unknown questionnaire fields go into <code className="font-mono">extra</code> until the schema adopts them, so the questionnaire can move faster than the engine.</li>
          <li><strong>Action Plan</strong>: plan ID, version, dates, the profile fingerprint it came from, summary, priorities, modules, actions, provider matches, sources and history.</li>
          <li><strong>Action</strong>: a stable key (<code className="font-mono">module:action</code>), title, description, priority, timing, responsible, status, module, source (<code className="font-mono">rules</code>, <code className="font-mono">ai</code>, <code className="font-mono">navigator</code>, <code className="font-mono">family</code>), notes and dates.</li>
        </ul>
        <Code>{`-- Production tables (Postgres)
families        (id uuid pk, created_at)
profiles        (id uuid pk, family_id fk, schema_version, data jsonb, hash, created_at)          -- every submitted version
plans           (id text pk 'AP-…', family_id fk, current_version text, created_at, updated_at)
plan_versions   (plan_id fk, version text, profile_id fk, data jsonb, reason, created_by, created_at,
                 primary key (plan_id, version))                                              -- immutable
actions         (plan_id fk, key text, status, priority, due_hint, responsible, updated_at,
                 primary key (plan_id, key))                                                  -- current state, for reminders and dashboards
documents       (id uuid pk, plan_id fk, version, kind, storage_key, sha256, created_at)      -- PDFs in encrypted object storage
modules         (id text, revision int, data jsonb, status 'draft'|'published', published_at)
audit_log       (at, actor, action, plan_id, version)                                         -- no personal data`}</Code>

        <H id="modules">Conditional modules</H>
        <p>A module is data: when it applies, how urgent it is, and the text and actions it contributes, following the standard format (what we noticed, why it matters, what to do next, who can help, questions worth asking, useful information, sources). Conditions use a small safe vocabulary, so content editors never write code:</p>
        <Code>{`{ "id": "falls-and-mobility",
  "when": { "any": [
    { "field": "mobility.fallsLast12Months", "op": "gte", "value": 1 },
    { "field": "mobility.fearOfFalling", "op": "truthy" } ] },
  "priority": { "default": "soon",
    "rules": [ { "when": { "field": "mobility.fallsLast12Months", "op": "gte", "value": 2 }, "level": "now" } ] },
  "noticed": [ { "text": "{{name}} has had {{falls}} in the last 12 months." } ],
  "actions": [ { "id": "gp-falls-review", "title": "Book a GP falls review", "timing": "Within 2 weeks",
                 "responsible": "{{preparedFor}}", "priority": "now" } ] }`}</Code>
        <ul className="list-disc space-y-1 pl-5">
          <li>Operators: <code className="font-mono">eq, neq, in, gte, lte, truthy, falsy, includes, exists</code>, combined with <code className="font-mono">all, any, not</code>. Every field a condition reads is checked against the profile schema in the test suite.</li>
          <li>Modules that do not apply are not in the plan at all. Priority is <em>Now</em>, <em>Soon</em> or <em>Plan ahead</em>; the top 3 to 5 modules become &ldquo;Your top priorities&rdquo;.</li>
          <li>New modules are added as records (the admin Modules page shows this) and published with a revision number; each plan records the module set it was generated with.</li>
          <li>The rule engine is a placeholder for the later decision logic and AI. They plug in at the same point and must return the same Action Plan shape.</li>
        </ul>

        <H id="versions">Versions and the living plan</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>Every plan has a unique ID, created and updated dates, and a version number (1.0, 1.1, …). Saved versions are immutable and can be reprinted exactly.</li>
          <li><strong>Regenerate</strong> after the profile changes: the previous version is passed to the engine, and actions are matched by their stable key, so status, notes and owner carry over. Actions that no longer apply are kept as &ldquo;No longer required&rdquo;, never silently deleted. Actions added by a navigator, the family or AI are never removed by regeneration.</li>
          <li><strong>Save progress</strong> without regenerating: status and notes changes become a new version with the reason recorded.</li>
          <li>Each version stores what changed: actions and topics added or removed, and which fields changed on which actions.</li>
        </ul>

        <H id="pdf">Document generation</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>Templates are plain TypeScript functions that return HTML and CSS, with all text escaped. The same template feeds the in-browser preview and the PDF, and could be called from another backend.</li>
          <li>Paged-media CSS handles the layout: an A4 page size, a full-bleed cover, running footers with plan reference and &ldquo;Page X of Y&rdquo;, repeated table headers, and <code className="font-mono">break-inside: avoid</code> on cards and rows. Long words and URLs wrap instead of overflowing.</li>
          <li>Empty sections are omitted, so short and long plans both read well. The test suite renders every test case, including a long-content case that switches on 16 of the 18 modules, and checks page counts and that no element overflows the page.</li>
          <li>Fonts (Atkinson Hyperlegible for legibility, Literata for headings) are embedded, so output never depends on the server&rsquo;s installed fonts. PDFs are tagged for screen readers.</li>
          <li>The Professional Summary is a second template over the same record, designed to fit on one or two pages. There is no second data entry.</li>
        </ul>

        <H id="api">API</H>
        <T head={["Endpoint", "Does", "Notes"]} rows={[
          ["POST /api/auth/login", "Starts an admin session", "Signed httpOnly cookie, 8 hours, rate limited"],
          ["POST /api/plans/generate", "Profile (+ previous version) → Action Plan", "Validates input; stateless"],
          ["POST /api/plans/validate", "Checks a plan from another system, such as AI output", "Returns every problem with its path"],
          ["POST /api/documents", "Plan + profile → PDF (plan or summary)", "Streamed, no-store, never written to disk"],
          ["GET /api/schemas/{name}", "JSON Schema for each contract", "family-profile, action-plan, module-definition"],
          ["GET /api/library", "Modules, sources and sample providers", "Admin only"],
        ]} />

        <H id="pilot">Running the pilot</H>
        <p>The next milestone is 50 plans, so the console tracks each one through the pilot: submitted, reviewed by a navigator, changes needed, approved, sent, and then the family&rsquo;s feedback. Each plan records the questionnaire version and the module set that produced it, so feedback from the third family can be compared with the fortieth after the questions have changed.</p>
        <T head={["Step", "Who", "What the system does"]} rows={[
          ["Family submits", "Family", "Answers validated, profile built, plan generated, both PDFs available immediately"],
          ["Review", "Navigator", "Plan opens in the console with urgent flags first; a note records what needs changing"],
          ["Send", "Navigator", "Plan marked as sent, which is what counts towards the 50"],
          ["Feedback", "Family", "Two questions, stored against the plan and its questionnaire version"],
        ]} />
        <p className="text-[14px] text-muted">In this demo the queue lives in the browser because there is no database. In production the same states sit on the plan record, and the review queue is a query.</p>

        <H id="security">Security and privacy</H>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Protected admin access</strong>: every admin page and API needs a signed session; failed sign-ins are rate limited and compared in constant time. Production would move this to the organisation&rsquo;s identity provider with per-user roles.</li>
          <li><strong>No public family information</strong>: there are no public pages or URLs containing personal data, and the site sends <code className="font-mono">noindex</code>.</li>
          <li><strong>No personal data in logs</strong>: the logger only accepts an allow-list of fields (IDs, counts, timings); anything else is dropped.</li>
          <li><strong>Documents and temporary files</strong>: PDFs are generated in memory with JavaScript disabled in the renderer and returned with <code className="font-mono">no-store</code>. In production they go to encrypted object storage and are shared through signed links that expire, with each access recorded in the audit log.</li>
          <li><strong>Data at rest</strong>: Postgres and storage encrypted, backups encrypted, and a retention policy agreed before real data is used.</li>
        </ul>

        <H id="integration">Future integration</H>
        <T head={["System", "How it connects"]} rows={[
          ["Online questionnaire", "Posts answers; a mapper turns them into a Family Profile and validates it"],
          ["AI analysis", "Returns actions or text in the published schema; validated, marked source: ai, reviewed by a person"],
          ["Decision engine", "Replaces or extends the rule step; must return the same Action Plan shape"],
          ["Knowledge repository", "Supplies the useful information items and sources by ID, with review dates"],
          ["Provider repository", "Feeds the transparent matcher; each option lists matched and unmatched criteria"],
          ["CRM, dashboards, reminders", "Read plans and the actions table; reminders use timing, status and owner"],
          ["Payments and subscriptions", "Sit outside the plan model; they reference plan IDs only"],
        ]} />

        <H id="stages">MVP stages</H>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Architecture and schema sign-off (this document, the JSON Schemas and the test cases).</li>
          <li>Plan engine and module library, with tests for every test family.</li>
          <li>Document templates for the plan and the summary, with page-break and overflow tests.</li>
          <li>Storage, versions and the admin test console, with security in place.</li>
          <li>Hand-over: documentation, a module-writing guide and a walkthrough with your team.</li>
        </ol>
      </article>
    </div>
  );
}
