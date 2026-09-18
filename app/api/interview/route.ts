import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { riskiest } from "@/lib/claims/risk";
import { claimsForFocus } from "@/lib/jd/match";
import { PRESSURE_LEVELS } from "@/lib/interview/questions";
import { TOTAL_QUESTIONS, nextQuestion } from "@/lib/interview/runner";
import { ScoredClaim } from "@/lib/claims/schema";
import { Analysis } from "@/lib/store/types";
import { getStore } from "@/lib/store";
import { ensureSessionId, newId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const CLAIMS_PER_INTERVIEW = 3;

const bodySchema = z.object({
  analysisId: z.string().min(1),
  pressure: z.enum(PRESSURE_LEVELS).default("realistic"),
  /** Set when starting from a claim detail page: that claim goes first. */
  claimId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const sessionId = await ensureSessionId();
    const body = bodySchema.parse(await request.json());

    const limit = rateLimit(`interview:${sessionId}`, 10, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "You've started a lot of interviews this hour. Give it a few minutes." },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const store = getStore();
    const analysis = await store.getAnalysis(body.analysisId);
    if (!analysis || analysis.sessionId !== sessionId) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const ordered = orderClaims(analysis, body.claimId);
    const interview = await store.createInterview({
      id: newId("i"),
      analysisId: analysis.id,
      sessionId,
      pressure: body.pressure,
      claimIds: ordered.map((claim) => claim.id),
      pendingQuestion: null,
    });

    const question = await nextQuestion(
      interview,
      analysis.claims,
      body.pressure,
      analysis.targetRole ?? undefined,
    );
    if (!question) {
      return NextResponse.json({ error: "Nothing to ask about." }, { status: 422 });
    }

    interview.pendingQuestion = question;
    await store.saveInterview(interview);

    return NextResponse.json({
      id: interview.id,
      question: question.question,
      claim: claimSummary(analysis.claims, question.claimId),
      index: 1,
      total: TOTAL_QUESTIONS,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Which claims this session attacks. Riskiest first by default; once the report
 * has been pointed at a posting (§21), the claims backing that posting's most
 * exposed requirements come first instead — an interview for a specific role
 * should press what that role will press. A claim the user clicked still wins
 * over both.
 */
function orderClaims(analysis: Analysis, focusId?: string) {
  const { claims, jobMatch } = analysis;

  const base = jobMatch
    ? claimsForFocus(jobMatch.requirements, claims, CLAIMS_PER_INTERVIEW)
        .map((claimId) => claims.find((claim) => claim.id === claimId))
        .filter((claim): claim is ScoredClaim => Boolean(claim))
    : riskiest(claims, CLAIMS_PER_INTERVIEW);

  if (!focusId) return base;

  const focus = claims.find((claim) => claim.id === focusId);
  if (!focus) return base;

  const rest = base.filter((claim) => claim.id !== focusId);
  return [focus, ...rest].slice(0, CLAIMS_PER_INTERVIEW);
}

function claimSummary(claims: { id: string; claim: string; sourceLine: string }[], id: string) {
  const claim = claims.find((entry) => entry.id === id);
  return claim ? { id: claim.id, claim: claim.claim, sourceLine: claim.sourceLine } : null;
}
