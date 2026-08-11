"use client";

import { useRef, useState } from "react";
import {
  PRESSURE_DESCRIPTIONS,
  PRESSURE_LABELS,
  PRESSURE_LEVELS,
  PressureLevel,
} from "@/lib/interview/questions";
import { AnswerEvaluation } from "@/lib/claims/schema";
import type { InterviewSummary } from "@/lib/interview/score";
import { Results } from "./results";

interface ClaimRef {
  id: string;
  claim: string;
  sourceLine: string;
}

interface Turn {
  question: string;
  answer: string;
  evaluation: AnswerEvaluation;
  claim: ClaimRef | null;
}

type Phase =
  | { kind: "setup" }
  | { kind: "asking"; question: string; claim: ClaimRef | null; index: number; total: number }
  | { kind: "done"; summary: InterviewSummary };

export function InterviewClient({
  analysisId,
  focusClaimId,
}: {
  analysisId: string;
  focusClaimId?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [pressure, setPressure] = useState<PressureLevel>("realistic");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId, pressure, claimId: focusClaimId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn't start the interview.");

      setInterviewId(payload.id);
      setPhase({
        kind: "asking",
        question: payload.question,
        claim: payload.claim,
        index: payload.index,
        total: payload.total,
      });
      requestAnimationFrame(() => answerRef.current?.focus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't start the interview.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (phase.kind !== "asking" || !interviewId || busy) return;

    const asked = phase;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/interview/${interviewId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn't score that answer.");

      setTranscript((current) => [
        ...current,
        {
          question: asked.question,
          answer: answer.trim(),
          evaluation: payload.evaluation,
          claim: asked.claim,
        },
      ]);
      setAnswer("");

      if (payload.done) {
        setPhase({ kind: "done", summary: payload.summary });
      } else {
        setPhase({
          kind: "asking",
          question: payload.question,
          claim: payload.claim,
          index: payload.index,
          total: payload.total,
        });
        requestAnimationFrame(() => answerRef.current?.focus());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't score that answer.");
    } finally {
      setBusy(false);
    }
  }

  if (phase.kind === "setup") {
    return (
      <div className="py-10">
        <div className="font-mono text-xs tracking-widest text-paper-faint">
          HOW HARD SHOULD THEY PUSH?
        </div>

        <div className="mt-6 space-y-px">
          {PRESSURE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setPressure(level)}
              className={`block w-full border-b border-ink-line px-4 py-5 text-left transition-colors ${
                pressure === level ? "bg-ink-raised" : "hover:bg-ink-raised/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    pressure === level ? "bg-risk-high" : "bg-ink-line"
                  }`}
                />
                <span className="text-[15px]">{PRESSURE_LABELS[level]}</span>
              </div>
              <p className="mt-1.5 pl-5 text-sm text-paper-dim">{PRESSURE_DESCRIPTIONS[level]}</p>
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-8 border-l-2 border-risk-veryhigh pl-4 text-sm text-paper-dim">{error}</p>
        ) : null}

        <button
          onClick={start}
          disabled={busy}
          className="mt-10 bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Preparing…" : "Begin"}
        </button>
        <p className="mt-4 text-sm text-paper-faint">
          Five questions, drawn only from what you wrote. Answer them the way you would out loud.
        </p>
      </div>
    );
  }

  if (phase.kind === "done") {
    return <Results analysisId={analysisId} summary={phase.summary} transcript={transcript} />;
  }

  return (
    <div className="py-10">
      <div className="flex items-center justify-between font-mono text-xs text-paper-faint">
        <span>
          QUESTION {phase.index} / {phase.total}
        </span>
        <span>{PRESSURE_LABELS[pressure].toUpperCase()}</span>
      </div>

      <div className="mt-3 h-px w-full bg-ink-line">
        <div
          className="h-px bg-risk-high transition-all duration-500"
          style={{ width: `${((phase.index - 1) / phase.total) * 100}%` }}
        />
      </div>

      {phase.claim ? (
        <blockquote className="claim-quote mt-10 text-paper-dim">
          {phase.claim.sourceLine}
        </blockquote>
      ) : null}

      <p key={phase.question} className="rise mt-8 text-2xl leading-snug font-light">
        {phase.question}
      </p>

      <textarea
        ref={answerRef}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submitAnswer();
        }}
        rows={8}
        disabled={busy}
        placeholder="Answer as if you were in the room…"
        className="mt-10 w-full resize-y border border-ink-line bg-ink-raised p-4 text-[15px] leading-relaxed outline-none focus:border-paper-faint disabled:opacity-50"
      />

      {error ? (
        <p className="mt-6 border-l-2 border-risk-veryhigh pl-4 text-sm text-paper-dim">{error}</p>
      ) : null}

      <div className="mt-6 flex items-center gap-5">
        <button
          onClick={submitAnswer}
          disabled={busy}
          className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Listening…" : "Answer"}
        </button>
        <span className="font-mono text-xs text-paper-faint">⌘↵</span>
        {!busy ? (
          <button
            onClick={submitAnswer}
            className="font-mono text-xs text-paper-faint underline underline-offset-4 hover:text-paper-dim"
          >
            I don&apos;t know
          </button>
        ) : null}
      </div>

      {transcript.length > 0 ? (
        <section className="mt-16 border-t border-ink-line pt-10">
          <h2 className="font-mono text-xs tracking-widest text-paper-faint">SO FAR</h2>
          <ol className="mt-6 space-y-8">
            {transcript.map((turn, index) => (
              <li key={index}>
                <p className="text-[15px] text-paper-dim">{turn.question}</p>
                <p className="mt-2 border-l-2 border-ink-line pl-4 text-sm text-paper-faint">
                  {turn.answer || "— no answer —"}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
