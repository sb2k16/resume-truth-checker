"use client";

import Link from "next/link";
import { AnswerEvaluation, DIMENSION_LABELS, SCORE_DIMENSIONS } from "@/lib/claims/schema";
import type { InterviewSummary } from "@/lib/interview/score";
import { ScoreDial } from "@/components/risk";

interface Turn {
  question: string;
  answer: string;
  evaluation: AnswerEvaluation;
  claim: { id: string; claim: string; sourceLine: string } | null;
}

export function Results({
  analysisId,
  summary,
  transcript,
}: {
  analysisId: string;
  summary: InterviewSummary;
  transcript: Turn[];
}) {
  return (
    <div className="rise py-10">
      <div className="border-b border-ink-line pb-12">
        <ScoreDial
          score={summary.overall}
          caption="INTERVIEW DEFENSIBILITY"
          hint={`Across ${summary.answered} answer${summary.answered === 1 ? "" : "s"} about your own resume.`}
        />
      </div>

      <section className="py-12">
        <ul className="space-y-4">
          {SCORE_DIMENSIONS.map((dimension) => {
            const score = summary.dimensions[dimension];
            return (
              <li key={dimension} className="grid grid-cols-[1fr_auto] items-center gap-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px]">{DIMENSION_LABELS[dimension]}</span>
                    <span className="font-mono text-sm tabular-nums text-paper-dim">{score}</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-line">
                    <div
                      className={`h-full rounded-full ${
                        score >= 75 ? "bg-risk-low" : score >= 50 ? "bg-risk-medium" : "bg-risk-high"
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-10 border-t border-ink-line py-12 sm:grid-cols-2">
        {summary.weakest ? (
          <div>
            <h2 className="font-mono text-xs tracking-widest text-risk-high">BIGGEST WEAKNESS</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-paper-dim">
              {summary.weakest.note}
            </p>
          </div>
        ) : null}
        {summary.strongest ? (
          <div>
            <h2 className="font-mono text-xs tracking-widest text-risk-low">STRONGEST AREA</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-paper-dim">
              {summary.strongest.note}
            </p>
          </div>
        ) : null}
      </div>

      {summary.integrityFlags.length > 0 ? (
        <section className="border-t border-ink-line py-12">
          <h2 className="font-mono text-xs tracking-widest text-risk-veryhigh">
            LINES THAT NO LONGER MATCH WHAT YOU TOLD US
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper-dim">
            Your answers described something different from what the resume claims. We won&apos;t
            suggest numbers or detail you didn&apos;t give us — only wording that matches what you
            actually did.
          </p>
          <ul className="mt-8 space-y-6">
            {summary.integrityFlags.map((flag) => (
              <li
                key={flag}
                className="border-l-2 border-risk-veryhigh pl-4 text-[15px] leading-relaxed"
              >
                {flag}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-ink-line py-12">
        <h2 className="font-mono text-xs tracking-widest text-paper-faint">THE TRANSCRIPT</h2>
        <ol className="mt-8 space-y-12">
          {transcript.map((turn, index) => (
            <li key={index}>
              <div className="font-mono text-[11px] text-paper-faint">
                Q{index + 1}
                {turn.claim ? ` · ${turn.claim.claim}` : ""}
              </div>
              <p className="mt-3 text-[17px] leading-snug">{turn.question}</p>
              <p className="mt-4 border-l-2 border-ink-line pl-4 text-sm leading-relaxed text-paper-dim">
                {turn.answer || "— no answer —"}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-paper-dim">
                <span className="font-mono text-[11px] tracking-widest text-paper-faint">
                  ASSESSMENT ·{" "}
                </span>
                {turn.evaluation.feedback}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-5 border-t border-ink-line pt-10">
        <Link
          href={`/r/${analysisId}`}
          className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85"
        >
          Back to the report
        </Link>
        <Link
          href={`/r/${analysisId}/interview`}
          className="font-mono text-sm text-paper-faint hover:text-paper-dim"
        >
          run it again
        </Link>
      </div>
    </div>
  );
}
