Yes, I have read the simplified MVP. Answers in your order.

1. Every question gets an id and the field it writes to, and the answers are mapped into one typed Family
Profile. The Action Plan is then built from that profile by rules held as data, never from the raw answers. That
is what the demo does: the questionnaire writes into a profile, each module declares the conditions under which it
applies, and the plan is what survives those conditions. It also means you can reword a question without touching
the plan logic.

2. To start immediately: the questionnaire as you want it, with answer options and which answers open which
follow-ups; the pathways you want in the pilot; your wording for actions; and one verified knowledge entry written
the way you want all of them written, meaning topic, when it applies, the plain English explanation, the next
step, who to contact, the official source and the date it was last checked. Then branding, your privacy and
consent wording, and two or three dummy families with the plan you would want each of them to receive. Those dummy
plans are the acceptance test: when the system produces them from the answers, the build is right.

3. Through an intermediate structured format, always. Answers, then profile, then rules, then a structured plan,
then wording. AI turns approved content into family friendly sentences; it does not decide eligibility, funding or
anything clinical, and what it writes is checked against the same schema before a family sees it. That buys three
things: the same answers always produce the same plan, you can point at the rule that produced a recommendation,
and the model cannot invent a funding rule. Generating the plan straight from the questionnaire with AI would make
every plan different and none of them checkable, which is the opposite of the repository being your point of
difference.

4. Keep WordPress as the front door for pages, the blog, SEO and the domain, and run the questionnaire and the
plan as an application on a subdomain such as plan.yourdomain.co.nz, styled to match and linked both ways. The
questionnaire is conditional logic, a stored family record and PDF generation. Inside WordPress that becomes a
stack of plugins that is slower to change and harder to test, exactly when you want to keep changing the questions
during the pilot, and it puts family health and funding information into a database with plugins around it, which
is a privacy conversation you do not need to have. On a subdomain the family record sits in one database you
control, with no plugin able to reach it.

What that costs you on the WordPress side is a DNS record for the subdomain and one button on a page, and I will
send your site person the exact link and the colours so it matches. If you would rather it appeared inside a
WordPress page, it can be embedded there and I will send the snippet, but I would still keep the data outside
WordPress. I build and run the application; I do not touch your theme or your plugins, which also means nothing I
do can break the site that is bringing you traffic.

5. The plan is a template with a fixed order of sections, and a section with nothing to say is left out rather
than printed empty. Every action is the same block: what to do, why it matters, the next step, who can help, what
to prepare, what to ask. The PDF is generated from HTML and CSS with print rules, so a block never splits across a
page break, and there are tests that check page counts and overflow for a short plan and a long one. In the demo a
family with two actions and a family with twenty produce the same document, at different lengths.

6. Yes. I would make that the navigator review step: the plan is generated, you read it, edit the wording or
remove an action, then release it to the family. Every edit is recorded against that version of the plan, so after
twenty families you can see which generated sentences kept needing correction, and that is what improves the
templates.

7. Yes, and this is the reason the questionnaire and the plan are content rather than code. Questions, options,
branching, modules, action templates and knowledge entries are versioned data. A change is an edit, plans already
produced keep the version that made them, and a regenerated plan carries progress forward and shows what changed.
If you want to make the edits yourself, phase one can include a simple admin screen for the questions and the
knowledge entries.

8. Roughly, and your content decides whether it holds: scope, schema and one pathway end to end, about two weeks;
the remaining pilot pathways with the plan and the PDF, one to two weeks; feedback, the implementation support
request, referral source and export, about a week; then a pilot run with dummy families and launch, about a week.
So five to six weeks of building, in milestones you can stop after.

9. [RATE ANSWER GOES HERE]

Valdis
