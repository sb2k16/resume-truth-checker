# AI Resume Truth Checker — Product Plan

**Saved:** 2026-08-08
**Status:** v1 scope (§40) code-complete and unverified against a real model — see §42 (2026-08-10)
**Version:** 1.1
**Product Type:** AI career / interview preparation
**MVP:** Web application
**Primary User:** Software engineers and technical professionals
**Core Promise:** Make every claim on your resume defensible.

> Constraint set by owner: **LLM must be free / open-source models only.** Self-hosting on Fly machines is acceptable if needed.

---

## Why this idea

It is narrow, cheap to build, easy to explain, and has a very clear "aha" moment.

The key is **not** to build another resume optimizer. The promise is stronger:

> **"We'll make sure you can defend everything on your resume before an interviewer does."**

---

# 1. Product Vision

AI Resume Truth Checker analyzes a user's resume and identifies claims that are:

* vague
* exaggerated
* difficult to substantiate
* missing measurable evidence
* technically questionable
* likely to trigger interviewer follow-up
* inconsistent with the candidate's experience

It then turns those claims into an interactive interview.

The system does not primarily ask:

> "How can we make your resume sound better?"

It asks:

> **"Can you actually defend everything you've written?"**

The product should help candidates avoid the most dangerous resume failure:

> Getting an interview because of a resume claim and then being unable to explain it convincingly.

---

# 2. Problem

Most resume tools optimize for:

* ATS keywords
* grammar
* formatting
* job matching
* stronger wording

But candidates have another problem.

Consider:

> "Designed a distributed system processing 10M events/day with 99.99% reliability."

An interviewer can immediately ask:

* What was the architecture?
* Why 10M?
* How did you measure it?
* What was the bottleneck?
* What did you personally build?
* What happened when Kafka went down?
* Why did you choose Kafka?
* What alternatives did you consider?
* How did you achieve 99.99%?
* What was your contribution versus the team's?

The resume checker should anticipate these questions.

---

# 3. Product Positioning

### Bad positioning

"AI Resume Builder" / "AI Resume Optimizer" / "Make your resume better with AI"

These are crowded categories.

### Recommended positioning

> **Your interviewer will question your resume. We do it first.**

Alternative:

> **Can you defend every line on your resume?**

Supporting statement:

> Upload your resume. We'll identify risky claims, find missing evidence, and conduct a realistic interview based entirely on your experience.

---

# 4. Target Users

## Primary

Software engineers preparing for:

* technical interviews
* senior engineer interviews
* Staff/Principal interviews
* FAANG interviews
* startup interviews

## Secondary

* product managers
* data scientists
* engineering managers
* researchers
* consultants

The MVP should focus exclusively on **software engineers**.

---

# 5. Core User Journey

```text
Landing Page
      |
      v
Upload Resume
      |
      v
Resume Analysis
      |
      v
Truth Report
      |
      +------------------+
      |                  |
      v                  v
Claim Review        Interview
      |                  |
      v                  v
Evidence             AI Questions
      |                  |
      +--------+---------+
               |
               v
        Defensibility Score
               |
               v
         Improve Resume
```

---

# 6. Landing Page

The landing page should be extremely simple.

## Hero

### Can you defend every line on your resume?

Upload your resume. We'll find the claims an interviewer is most likely to challenge.

**[Analyze My Resume]**

Supporting text:

> No resume rewriting. No generic career advice. Just an honest assessment of whether you can defend your experience.

---

## Example

Show a fake resume bullet:

> "Reduced API latency by 40%."

Then show:

### Interviewer Questions

> What was the baseline?

> How did you measure the 40%?

> Was this p50, p95, or p99?

> What did you personally change?

> What was the primary bottleneck?

This immediately demonstrates the product.

---

# 7. Onboarding

Keep onboarding extremely short.

### Step 1

Upload resume. Supported: PDF, DOCX, TXT

### Step 2

Optional: *What role are you preparing for?* (Senior SWE, Staff SWE, Engineering Manager, ML Engineer)

### Step 3

Optional: *Paste the job description.* This allows the system to tailor questioning.

No account should be required before the first analysis if technically feasible.

---

# 8. Resume Parsing

The system converts the resume into structured claims.

Resume:

> "Designed and implemented a distributed caching system that reduced database load by 60%."

Internal representation:

```json
{
  "claim": "Reduced database load by 60%",
  "category": "impact",
  "technical_domain": "distributed systems",
  "technologies": ["cache"],
  "quantification": "60%",
  "ownership": "designed and implemented",
  "evidence_required": [
    "baseline",
    "measurement_method",
    "traffic_volume",
    "time_period",
    "personal_contribution"
  ]
}
```

---

# 9. Claim Extraction

Every meaningful resume bullet becomes one or more claims.

Categories:

* **Impact** — increased revenue, reduced latency, reduced cost, improved reliability
* **Scale** — 10M users, 100K requests/sec, petabytes of data
* **Technical** — designed distributed system, migrated database, built ML pipeline
* **Ownership** — led migration, architected platform, drove project
* **Leadership** — mentored engineers, led team, influenced architecture
* **Innovation** — developed new algorithm, created new platform, invented solution

---

# 10. Truth Risk Engine

Each claim receives a risk score.

```text
Claim:
"Reduced latency by 47%."

Risk: HIGH

Why?

✓ Strong quantitative claim
✓ No baseline
✓ No measurement methodology
✓ No timeframe
✓ Personal contribution unclear

Likely interviewer pressure:
HIGH
```

---

# 11. Claim Risk Levels

### LOW
Straightforward factual statement — "Implemented a REST API using Java."

### MEDIUM
Requires explanation — "Improved service reliability."

### HIGH
Strong quantitative or ownership claim — "Reduced infrastructure costs by 65%."

### VERY HIGH
Major architectural or organizational claim — "Architected the company's distributed data platform."

---

# 12. Defensibility Score

```text
Resume Defensibility

78 / 100

████████████████░░░░

Strong areas

✓ Technical implementation
✓ AWS experience
✓ Distributed systems

Risk areas

⚠ Quantitative claims
⚠ Ownership language
⚠ Business impact claims

High-risk claims

4

Claims requiring evidence

7
```

The score should NOT mean "Your resume is good." It means:

> **"How prepared are you to defend what you've written?"**

---

# 13. Claim Detail Screen

```text
CLAIM

Reduced API latency by 47%

Risk

HIGH

Why an interviewer may challenge it

You haven't specified:

• Baseline latency
• Percentile
• Measurement period
• Traffic volume
• Measurement methodology
• Your specific contribution

Likely questions

1. What was the baseline?
2. How did you measure the improvement?
3. Was this p50 or p99?
4. What change produced the improvement?
5. What other factors contributed?

Evidence

[Add Evidence]

[Practice This Claim]
```

---

# 14. Evidence System

One of the most important parts of the product. The user attaches evidence to a claim.

```text
Claim

Reduced latency by 47%

Evidence

✓ Grafana dashboard
✓ Design document
✓ GitHub PR
✓ Performance benchmark
✓ Launch document
✓ Personal notes
```

The user doesn't need to upload confidential company documents. They can instead provide a description:

> "Before the change p99 was ~800ms. After deployment it was ~420ms based on CloudWatch metrics."

The AI evaluates whether the evidence adequately supports the claim.

---

# 15. Personal Contribution Check

A major feature. The AI distinguishes between:

> "Our team reduced latency by 47%."

and

> "I reduced latency by 47%."

The second is a much stronger claim. The AI asks: *What exactly did you personally do?*

Answer:

> "I redesigned the caching layer and implemented the invalidation strategy."

The system then generates:

```text
Contribution Confidence

HIGH

You can clearly explain:

• Problem
• Your contribution
• Technical implementation
• Result
```

---

# 16. Interview Mode

The killer feature. The AI becomes the interviewer.

### AI
> You wrote that you reduced API latency by 47%. Walk me through exactly how you achieved that.

User answers verbally or by text.

### AI
> What was the baseline p99 latency?

User:
> Around 800ms.

### AI
> How did you determine that the database was the primary contributor?

The system keeps drilling down.

The important characteristic: **it doesn't generate random interview questions.** Every question comes from the user's resume.

---

# 17. Interview Pressure Levels

* **Friendly** — AI helps when the answer is weak.
* **Realistic** — normal interviewer.
* **Aggressive** — Staff-level interviewer who challenges assumptions.

Example escalation:

> You said this architecture scales to 100K requests per second. What evidence do you have?

> That's a theoretical capacity. What was the highest production traffic you actually observed?

> So would you still put "scales to 100K RPS" on your resume?

---

# 18. Interview Evaluation

```text
Interview Results

Overall Defensibility

82 / 100

Technical Depth       91
Ownership             84
Metrics               76
Tradeoffs             79
Communication         81
System Thinking       88
```

### Biggest weakness
> You understand the architecture but have difficulty explaining how you measured business impact.

### Strongest area
> You clearly understand the technical tradeoffs behind your distributed systems work.

---

# 19. Resume Claim Heatmap

The resume itself becomes interactive.

```text
Your Resume

AWS
Software Development Engineer

"Designed a distributed ingestion
platform processing 10M events/day."

████ HIGH RISK

"Reduced operational incidents by 70%."

████ VERY HIGH RISK

"Implemented Java services."

█ LOW RISK

"Led migration to OpenSearch."

███ MEDIUM RISK
```

---

# 20. Resume Rewrite

Only after the truth analysis should the product suggest rewriting.

### Original
> Reduced latency by 47%.

### Problem
The user cannot substantiate the exact number.

### Recommended
> Redesigned the caching layer, reducing API latency substantially under production workloads.

Importantly: **the system must never invent a number.** It preserves factual integrity.

---

# 21. Job Description Mode

```text
Your Resume

Distributed systems       █████████
AWS                        █████████
Leadership                 ██████
AI/ML                      ███

Job requires

Distributed systems         ✓
AWS                         ✓
Leadership                  ✓
AI infrastructure           ⚠

Likely interview focus

1. Distributed systems
2. Technical leadership
3. AI infrastructure
```

The interview then prioritizes those areas.

---

# 22. Dashboard

```text
----------------------------------------

Resume Truth Checker

Defensibility Score

82 / 100

↑ 11 points since last review


HIGH-RISK CLAIMS

4

Needs evidence

7


Resume

[View Claims]


Practice

[Start Interview]


Target Role

Staff Software Engineer


Recent Sessions

System Design Interview
84 / 100

Resume Defense
79 / 100

AWS Experience
91 / 100

----------------------------------------
```

---

# 23. MVP Phase 1

### Required

1. Resume upload
2. PDF/DOCX parsing
3. Claim extraction
4. Claim categorization
5. Risk scoring
6. Interview question generation
7. Interactive interview
8. Defensibility score
9. Claim-level feedback
10. Basic resume rewrite suggestions

### Optional

* Job description upload
* Voice interview
* Evidence attachments

### Do NOT build yet

* LinkedIn integration
* Full career coaching
* Resume templates
* Job board
* Applicant tracking
* Networking
* Automated applications
* Long-term career planning

---

# 24. MVP User Experience

The entire first session should take approximately 10 minutes.

```text
Upload Resume
      ↓
30–60 sec analysis
      ↓
Truth Report
      ↓
Review 3 risky claims
      ↓
Start Interview
      ↓
Answer 5 questions
      ↓
Receive score
```

The user should leave thinking:

> "I just discovered three things on my resume that I wouldn't have been able to explain."

That is the product's aha moment.

---

# 25. MVP Phase 2

* **Voice Interview** — the user speaks instead of typing.
* **Adaptive Interview** — questions become harder based on answers.
* **Job-Specific Interview** — resume + job description → customized interview.
* **Evidence Vault** — users build evidence for important claims.
* **Resume Versions** — Google Resume / Meta Resume / Startup Resume / Staff Resume, each with a different defensibility profile.
* **Interview History** — the AI remembers weaknesses ("You have struggled to explain metrics in your last three sessions.").

---

# 26. Phase 3

## Career Evidence Graph

```text
Career

AWS
 |
 |-- OpenSearch
 |-- Distributed Systems
 |-- Leadership
 |-- Cost Optimization
 |
 |-- Project A
 |      |
 |      |-- 70% reduction
 |      |-- Architecture
 |      |-- Team leadership
 |
 |-- Project B
```

The resume becomes a presentation layer over this evidence graph. Instead of writing a resume first, the user builds a **career evidence base**, from which the AI generates: resume, interview stories, promotion packet, performance review, LinkedIn profile, job-specific application, leadership examples.

This should come much later.

---

# 27. Technical Architecture

```text
                  Browser
                     |
                     v
                Web Frontend
                     |
                     v
                 API Server
                     |
        +------------+------------+
        |                         |
        v                         v
 Resume Parser              LLM Service
        |                         |
        v                         v
 Structured Claims        Claim Analysis
        |                         |
        +------------+------------+
                     |
                     v
                Database
                     |
                     v
              Interview Engine
```

---

# 28. Suggested Stack

* **Frontend:** Next.js / React
* **Backend:** TypeScript or Python
* **Database:** PostgreSQL
* **Authentication:** optional for initial MVP
* **File Storage:** S3-compatible storage
* **AI:** free/open-source LLM (self-hosted on Fly machines if needed) rather than training a model

The differentiator is not the base model. The differentiator is:

* claim extraction
* evidence model
* interview logic
* evaluation framework
* longitudinal user data

---

# 29. Core Data Model

### User
```text
id
email
created_at
```

### Resume
```text
id
user_id
version
raw_document
parsed_text
created_at
```

### Claim
```text
id
resume_id
text
category
risk_score
confidence
evidence_required
```

### Evidence
```text
id
claim_id
description
type
confidence
```

### Interview
```text
id
resume_id
job_description_id
difficulty
score
created_at
```

### Question
```text
id
interview_id
claim_id
question
answer
score
feedback
```

---

# 30. AI Pipeline

1. Extract resume sections.
2. Extract claims.
3. Classify claims.
4. Identify unverifiable assertions.
5. Generate evidence requirements.
6. Generate likely interviewer questions.
7. Run interview.
8. Evaluate answer against claim.
9. Identify weaknesses.
10. Calculate defensibility score.

---

# 31. Important AI Safety / Integrity Rule

The system must never encourage users to fabricate experience.

If a user says:

> "I didn't actually lead this project."

The AI should respond:

> Consider changing "Led" to language that accurately reflects your contribution.

The brand should be built around **truthfulness and preparation**, not gaming interviews.

---

# 32. Metrics

* **Activation** — % of users who upload a resume and complete analysis.
* **Aha** — % who review at least one high-risk claim.
* **Interview completion** — % completing at least one interview.
* **Repeat usage** — users returning before an actual interview.
* **Conversion** — % paying for additional interviews/reports.

---

# 33. The Critical Validation Experiment

Before building the full product, build only this:

```text
Upload Resume
      ↓
AI extracts 10 claims
      ↓
Pick 3 highest-risk claims
      ↓
Generate 5 interviewer questions
      ↓
User answers
      ↓
Show weaknesses
```

That's enough to test the idea.

---

# 34. Pricing Experiment

* **Free** — 1 resume analysis, 5 interview questions, basic defensibility score
* **$9 one-time** — full resume defense, 25 questions, voice interview
* **$15/month** — unlimited interviews, job-specific interviews, resume versions, interview history
* **$49–79** — interview preparation package (resume analysis + multiple targeted interview sessions)

Test **one-time payment** before forcing a subscription. Interview preparation is inherently episodic: someone with an interview next week may happily pay $15–30 but won't want another monthly subscription afterward.

---

# 35. Distribution

Do not try to build a generic consumer audience. Start with communities where the problem is already painful:

* Reddit engineering communities
* Hacker News
* LinkedIn engineering communities
* university career centers
* coding bootcamps
* engineering interview communities
* Discord communities
* developer communities

Content marketing can be extremely specific:

> "I analyzed 100 software engineering resumes. Here are the 15 resume bullets that trigger the hardest interview questions."

> "If your resume says 'improved performance by 40%', expect these questions."

The content itself demonstrates the product.

---

# 36. The First 100 Users

Do not wait for SEO. Personally recruit them.

> I'm building a tool that attacks resumes from the interviewer's perspective. If you send me your resume, I'll show you the 5 claims I'd challenge in an interview.

Do this manually for the first 20–30 people. Record:

* Which claims cause problems?
* Which questions are most useful?
* Which feedback surprises users?
* Would they pay?
* What do they want next?

Then automate the parts that repeat.

---

# 37. Competitive Differentiation

Avoid becoming: Resume Builder / Resume Formatter / ATS Optimizer / Grammar Checker / Generic AI Career Coach.

Instead:

```text
Resume
   ↓
Claims
   ↓
Evidence
   ↓
Interrogation
   ↓
Defensibility
```

That is the unique product loop.

---

# 38. Long-Term Vision

Not a resume checker — a **Career Evidence Intelligence Platform**.

```text
What you built
      ↓
What you actually contributed
      ↓
What evidence supports it
      ↓
How well you explain it
      ↓
What roles it qualifies you for
      ↓
What experiences you need next
```

Eventually it answers:

> "What is the strongest version of my career story that I can honestly defend?"

---

# 39. Product North Star

Optimize for **Interview Confidence** — not resume score, not ATS score, not number of resumes generated.

The user should finish a session thinking:

> "If an interviewer asks me about anything on my resume, I'm ready."

---

# 40. What to Actually Build First

Phase 1 should be **much smaller than the spec**, launchable in roughly 1–2 weeks:

* **Screen 1:** Landing page
* **Screen 2:** Upload resume
* **Screen 3:** "Your 5 riskiest claims"
* **Screen 4:** Claim detail + likely questions
* **Screen 5:** AI interview
* **Screen 6:** Results / defensibility score

That's it.

Make the first version **free**. The objective isn't revenue initially; it's to find out whether users repeatedly react:

> **"Holy shit, I didn't realize an interviewer could ask all of that from one sentence on my resume."**

If that reaction repeats, *then* build evidence tracking, voice interviews, job-specific interviews, and the career evidence graph.

This can eventually connect to the **Codexa / AI engineering interview** direction without building another giant platform from day one.

---

# 41. v1 Decisions (locked 2026-08-08)

| Question | Decision |
| --- | --- |
| **LLM serving** | Hosted **free-tier open-weight** endpoints behind a provider abstraction (`lib/llm`). OpenRouter free models primary, Groq secondary, Ollama for local dev. Self-hosting on a Fly GPU stays a one-adapter swap for later. **No closed models.** |
| **v1 scope** | The 6 screens from §40 only. Evidence system, job-description mode, rewrite, dashboard, voice → deferred. |
| **Auth & persistence** | Anonymous — no login before first analysis. Server-side session keyed by an httpOnly cookie. Raw resume file is **not** stored; only extracted text + derived claims. |
| **Budget** | ~$0–20/mo. Free inference tiers, Neon free tier, Vercel. Rate-limit handling and model fallback are therefore first-class. |

## Consequences of the budget decision

* Every LLM call goes through a fallback chain of free models; a 429 on one model transparently retries the next.
* Analysis is a single batched extraction call (not one call per bullet) to stay inside free-tier rate limits.
* Interview turns are one call each — the only per-turn cost — capped at the session length.
* No blob storage: parsing happens in-process, the file is discarded after text extraction.

---

# 42. Implementation status & build sequence (2026-08-10)

Header at the top of this file says "implementation not started". That is no longer true — the
v1 scope from §40 is code-complete and unverified. This section records what exists, what is
missing, and the order to work in.

**Verified 2026-08-10:** `npm run typecheck`, `npm run lint`, and `npm run build` all pass;
68 tests across 6 files pass. All work is uncommitted on top of the single
`Initial commit from Create Next App`.

## 42.1 What is built

All six screens from §40 exist and the full `Resume → Claims → Risk → Interview → Score` loop
is wired end to end.

| Plan section | Status | Where |
| --- | --- | --- |
| §6 Landing | Done — hero, the "Reduced API latency by 40%" example, the 5 questions | `app/page.tsx` |
| §7 Upload | Done — PDF/DOCX/TXT, paste fallback for scanned PDFs, optional target role | `app/upload/`, `lib/parse/extract-text.ts` |
| §8–9 Parsing & claim extraction | Done — one batched call, one JSON-repair retry, dedupe | `lib/claims/extract.ts` |
| §10–11 Risk engine | Done — **deterministic in code**, not LLM-scored | `lib/claims/risk.ts`, pinned by `tests/risk.test.ts` |
| §12 Defensibility score | Done — mean + p90 blend, so safe bullets can't hide two indefensible ones | `lib/claims/risk.ts` |
| §13 Claim detail | Done — gaps, missing evidence, likely questions behind Suspense | `app/r/[id]/claims/[claimId]/page.tsx` |
| §16–17 Interview | Done — 3 pressure levels, 5 questions, 2 per claim, follow-ups react to the prior answer | `lib/interview/`, `app/r/[id]/interview/` |
| §18 Evaluation | Done — 6 weighted dimensions, weakest/strongest, transcript | `lib/interview/score.ts` |
| §19 Heatmap | Partial — the report lists every claim with a risk bar, but does not render the resume itself | `app/r/[id]/page.tsx` |
| §31 Integrity rule | Done — `resumeIntegrityFlag` surfaces a mismatch without inventing numbers | `lib/interview/evaluate.ts` |
| §41 LLM abstraction | Done — OpenRouter → Groq → Ollama chain, a 429 falls through | `lib/llm/` |
| §41 Anonymous session | Done — httpOnly cookie, raw file never persisted, report bound to session | `lib/session.ts`, `lib/load-analysis.ts` |

Deferred per §41 and correctly absent: evidence system, job-description mode, dashboard, voice.

## 42.2 The governing fact

**This code has never talked to a real model.** There is no `.env.local`, no API key, no
database. Every prompt in `extract.ts`, `questions.ts`, and `evaluate.ts` is unvalidated
guesswork that happens to typecheck. That dominates the sequence below.

## 42.3 Phase 0 — Prove it works at all

1. **Commit what exists.** ~2,500 lines untracked. Branch and commit before touching anything,
   including the AGENTS.md block, per its own instructions.
2. **Get an OpenRouter key; write `.env.local`** (`OPENROUTER_API_KEY`, optionally `GROQ_API_KEY`).
3. **Verify the model chain is not stale.** `DEFAULT_CHAIN` in `lib/llm/index.ts:22` hardcodes six
   IDs (`deepseek/deepseek-chat-v3-0324:free`, `qwen/qwen3-235b-a22b:free`, …). Free-tier IDs churn
   constantly. Check each against the live catalog and prune the dead ones.
4. **Run `scripts/smoke.mts` against a real model.** It already prints what the report screen
   would show, so a prompt change can be judged on output rather than on whether types compile.
5. **Walk the whole flow in the browser** with a real resume.

**Exit criterion is not "it ran."** It is §33: do the 5 riskiest claims and their questions make
you flinch? If a free open model cannot produce that reaction, nothing below matters. Expect the
real Phase 0 work to be prompt iteration, not code.

## 42.4 Phase 1 — Make it survivable in production

6. **Provision Neon, set `DATABASE_URL`.** Not optional, despite what `lib/store/index.ts:14`
   implies: `MemoryStore` is per-process, so on serverless an analysis written by one instance is
   a 404 on the next. Today the app is only correct on a single long-lived server.
7. **Rate-limit `POST /api/interview/[id]/answer`.** It has none. Each answer costs *two* LLM calls
   (evaluate + next question) and is unbounded — the largest free-tier hole. The other two routes
   are limited.
8. **Reuse pre-generated openers.** `lib/interview/runner.ts:59` calls `generateQuestions(count:1)`
   for the first question even though `attachLikelyQuestions` already generated five at analysis
   time. One wasted free-tier call per interview.
9. **Add a Postgres TTL sweep.** `MemoryStore` expires records at 6h; `PostgresStore` keeps resume
   text forever. Add a delete-older-than cron and say so in the UI — §41 promised the *file* isn't
   stored, but the extracted text is.
10. **Deploy to Vercel** with those env vars, then walk the flow again on the deployed URL.

## 42.5 Phase 2 — Close the real UX holes

11. **Interview resume-on-refresh.** The transcript lives in React state; a refresh mid-interview
    loses it even though the server has every turn. Needs `GET /api/interview/[id]` and client
    rehydration.
12. **Keyboard-accessible dropzone.** `app/upload/upload-form.tsx:98` is a bare `div` with
    `onClick` — no `role`, `tabIndex`, or key handler.
13. **`loading.tsx` and `error.tsx` for `/r/[id]`.** Cold Neon plus Suspense question generation
    means visible dead air.
14. **Write a real README** — setup, env vars, model chain, how to run the smoke script. It is
    still stock create-next-app.

## 42.6 Phase 3 — Instrument, then decide

15. **Log the §32 funnel:** analysis completed, claim detail opened (the aha), interview started,
    interview completed. Without it there is no way to tell whether the §33 experiment passed.
16. **Recruit the first 10 resumes by hand** (§36). Record which claims and which questions land.

## 42.7 Open decision: resume rewrite

§23 lists "basic resume rewrite suggestions" as MVP-required; §41 defers rewrite entirely. These
conflict, and rewrite is genuinely not built — only the interview-time `resumeIntegrityFlag`,
which fires *after* an answer contradicts a line, not on the report itself.

Recommendation: keep it deferred. §41 is the later and more considered decision, and rewrite is
the one feature that pulls the product back toward the crowded optimizer category §37 warns
against. If it goes into v1 anyway, it slots in as Phase 2.5 — a per-claim "how would you word
this honestly?" action, hard-constrained to never introduce a number the user did not supply.
