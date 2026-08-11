import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAnswer, isNonAnswer, nonAnswerEvaluation } from "@/lib/interview/evaluate";
import { TOTAL_QUESTIONS, claimsInPlay, nextQuestion } from "@/lib/interview/runner";
import { summarize } from "@/lib/interview/score";
import { getStore } from "@/lib/store";
import { readSessionId } from "@/lib/session";
import { toErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  answer: z.string().max(6000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sessionId = await readSessionId();
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());

    const store = getStore();
    const interview = await store.getInterview(id);
    if (!interview || !sessionId || interview.sessionId !== sessionId) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }
    if (interview.completedAt) {
      return NextResponse.json({ error: "This interview is already finished." }, { status: 409 });
    }

    const pending = interview.pendingQuestion;
    if (!pending) {
      return NextResponse.json({ error: "No question is waiting for an answer." }, { status: 409 });
    }

    const analysis = await store.getAnalysis(interview.analysisId);
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const claim = claimsInPlay(interview, analysis.claims).find(
      (entry) => entry.id === pending.claimId,
    );
    if (!claim) {
      return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    }

    // Skip the model entirely on empty answers: it costs a free-tier call to
    // learn what we already know.
    const evaluation = isNonAnswer(body.answer)
      ? nonAnswerEvaluation()
      : await evaluateAnswer(claim, pending.question, body.answer, interview.pressure);

    interview.turns.push({
      claimId: claim.id,
      question: pending.question,
      answer: body.answer.trim(),
      evaluation,
      askedAt: new Date().toISOString(),
    });
    interview.pendingQuestion = null;

    const upcoming = await nextQuestion(
      interview,
      analysis.claims,
      interview.pressure,
      analysis.targetRole ?? undefined,
    );

    if (upcoming) {
      interview.pendingQuestion = upcoming;
      await store.saveInterview(interview);
      return NextResponse.json({
        done: false,
        evaluation,
        question: upcoming.question,
        claim: summaryOf(analysis.claims, upcoming.claimId),
        index: interview.turns.length + 1,
        total: TOTAL_QUESTIONS,
      });
    }

    interview.completedAt = new Date().toISOString();
    await store.saveInterview(interview);

    return NextResponse.json({
      done: true,
      evaluation,
      summary: summarize(interview.turns.map((turn) => turn.evaluation)),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function summaryOf(claims: { id: string; claim: string; sourceLine: string }[], id: string) {
  const claim = claims.find((entry) => entry.id === id);
  return claim ? { id: claim.id, claim: claim.claim, sourceLine: claim.sourceLine } : null;
}
