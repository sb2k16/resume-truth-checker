import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EVIDENCE_LABELS, ScoredClaim } from "@/lib/claims/schema";
import { generateQuestions } from "@/lib/interview/questions";
import { suggestRewrite } from "@/lib/claims/rewrite";
import { loadAnalysis } from "@/lib/load-analysis";
import { RiskBadge } from "@/components/risk";

export const metadata = { title: "Claim detail — Resume Truth Checker" };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string; claimId: string }>;
}) {
  const { id, claimId } = await params;
  const analysis = await loadAnalysis(id);
  const claim = analysis.claims.find((entry) => entry.id === claimId);
  if (!claim) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link
        href={`/r/${analysis.id}`}
        className="font-mono text-xs text-paper-faint hover:text-paper-dim"
      >
        ← back to report
      </Link>

      <div className="mt-10 font-mono text-xs tracking-widest text-paper-faint">CLAIM</div>
      <h1 className="mt-4 text-2xl leading-snug font-light tracking-tight">{claim.claim}</h1>
      <blockquote className="claim-quote mt-6">{claim.sourceLine}</blockquote>

      <div className="mt-8 flex items-center gap-4">
        <RiskBadge level={claim.riskLevel} />
        <span className="font-mono text-xs text-paper-faint">{claim.riskScore} / 100</span>
        <span className="font-mono text-xs text-paper-faint">{claim.category}</span>
      </div>

      {claim.riskReasons.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-mono text-xs tracking-widest text-paper-faint">
            WHY AN INTERVIEWER MAY CHALLENGE IT
          </h2>
          <ul className="mt-5 space-y-2.5">
            {claim.riskReasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-[15px] leading-relaxed text-paper-dim">
                <span className="text-paper-faint">·</span>
                {reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {claim.evidenceRequired.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-mono text-xs tracking-widest text-paper-faint">
            YOU HAVEN&apos;T SPECIFIED
          </h2>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {claim.evidenceRequired.map((kind) => (
              <li key={kind} className="flex gap-3 text-[15px] text-paper-dim">
                <span className="text-risk-medium">○</span>
                {EVIDENCE_LABELS[kind]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-14 border-t border-ink-line pt-12">
        <h2 className="font-mono text-xs tracking-widest text-risk-high">LIKELY QUESTIONS</h2>
        <Suspense fallback={<QuestionsSkeleton />}>
          <LikelyQuestions claim={claim} targetRole={analysis.targetRole} />
        </Suspense>
      </section>

      <section className="mt-14 border-t border-ink-line pt-12">
        <h2 className="font-mono text-xs tracking-widest text-risk-low">
          HOW TO MAKE IT DEFENSIBLE
        </h2>
        <Suspense fallback={<RewriteSkeleton />}>
          <Rewrite claim={claim} targetRole={analysis.targetRole} />
        </Suspense>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-4">
        <Link
          href={`/r/${analysis.id}/interview?claim=${claim.id}`}
          className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85"
        >
          Practice this claim
        </Link>
        <Link
          href={`/r/${analysis.id}`}
          className="font-mono text-sm text-paper-faint hover:text-paper-dim"
        >
          back to report
        </Link>
      </div>
    </main>
  );
}

/**
 * Questions are normally pre-generated during analysis. This path only runs when
 * that best-effort call was rate-limited, so it streams in behind Suspense
 * rather than holding up the rest of the page.
 */
async function LikelyQuestions({
  claim,
  targetRole,
}: {
  claim: ScoredClaim;
  targetRole: string | null;
}) {
  let questions = claim.likelyQuestions;

  if (questions.length === 0) {
    try {
      questions = await generateQuestions(claim, {
        count: 5,
        targetRole: targetRole ?? undefined,
      });
    } catch {
      return (
        <p className="mt-5 text-sm leading-relaxed text-paper-faint">
          The free models are rate-limited right now, so we couldn&apos;t write the questions for
          this claim. The interview will still work — try again in a minute.
        </p>
      );
    }
  }

  return (
    <ol className="mt-6 space-y-4">
      {questions.map((question, index) => (
        <li key={question} className="flex gap-4 text-[17px] leading-relaxed">
          <span className="pt-1 font-mono text-xs text-paper-faint">{index + 1}</span>
          <span>{question}</span>
        </li>
      ))}
    </ol>
  );
}

function QuestionsSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-ink-raised" style={{ width: `${70 - index * 6}%` }} />
      ))}
    </div>
  );
}

/**
 * §20: the rewrite comes last on the page, after the questions. Seeing what an
 * interviewer would ask is the point of the product; the reword is what you do
 * once you have read them, which is why it doesn't lead.
 *
 * Generated on demand rather than at analysis time — only the claims a person
 * actually opens need one, and each is a free-tier call.
 */
async function Rewrite({
  claim,
  targetRole,
}: {
  claim: ScoredClaim;
  targetRole: string | null;
}) {
  let suggestion;
  try {
    suggestion = await suggestRewrite(claim, targetRole ?? undefined);
  } catch {
    // Covers both a rate-limited chain and a model that fabricated a figure
    // twice. Either way the honest move is to say nothing rather than print a
    // rewrite we can't stand behind.
    return (
      <p className="mt-5 text-sm leading-relaxed text-paper-faint">
        We couldn&apos;t write a suggestion for this claim right now. The questions above still
        stand — try again in a minute.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <div className="font-mono text-[11px] tracking-widest text-paper-faint">AS WRITTEN</div>
      <p className="mt-2 text-[15px] leading-relaxed text-paper-faint line-through decoration-ink-line">
        {claim.sourceLine}
      </p>

      <div className="mt-7 font-mono text-[11px] tracking-widest text-risk-low">
        DEFENSIBLE WORDING
      </div>
      <p className="mt-2 text-[17px] leading-relaxed">{suggestion.rewrite}</p>
      <p className="mt-3 text-sm leading-relaxed text-paper-dim">{suggestion.rationale}</p>

      {suggestion.prepare.length > 0 ? (
        <>
          <div className="mt-9 font-mono text-[11px] tracking-widest text-paper-faint">
            OR KEEP THE ORIGINAL AND GO AND FIND
          </div>
          <ul className="mt-3 space-y-2.5">
            {suggestion.prepare.map((item) => (
              <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-paper-dim">
                <span className="text-risk-medium">○</span>
                {item}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-paper-faint">
        Suggestions never add a number you didn&apos;t write. Anything measured has to come from
        you.
      </p>
    </div>
  );
}

function RewriteSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-ink-raised"
          style={{ width: `${80 - index * 14}%` }}
        />
      ))}
    </div>
  );
}
