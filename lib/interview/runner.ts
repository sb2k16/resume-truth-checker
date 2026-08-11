import { ScoredClaim } from "@/lib/claims/schema";
import { Interview } from "@/lib/store/types";
import { PressureLevel, generateFollowUp, generateQuestions } from "./questions";

/** Five questions is the §24 session: long enough to hurt, short enough to finish. */
export const TOTAL_QUESTIONS = 5;
/** Two turns per claim — the opener, then the drill-down that exposes the gap. */
export const QUESTIONS_PER_CLAIM = 2;

export function claimsInPlay(
  interview: Pick<Interview, "claimIds">,
  claims: ScoredClaim[],
): ScoredClaim[] {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  return interview.claimIds
    .map((id) => byId.get(id))
    .filter((claim): claim is ScoredClaim => Boolean(claim));
}

/**
 * Which claim the next question belongs to. Turns are spread across claims in
 * order, so a session covers several weak claims rather than exhausting one.
 */
export function nextClaimIndex(turnCount: number): number {
  return Math.floor(turnCount / QUESTIONS_PER_CLAIM);
}

export function isComplete(interview: Interview): boolean {
  return interview.completedAt !== null || interview.turns.length >= TOTAL_QUESTIONS;
}

export interface NextQuestion {
  claimId: string;
  question: string;
}

/**
 * Produce the next question, or null when the session is done. The opener comes
 * from the claim's own gaps; every question after that reacts to the answer
 * just given, which is what separates this from a canned question bank.
 */
export async function nextQuestion(
  interview: Interview,
  claims: ScoredClaim[],
  pressure: PressureLevel,
  targetRole?: string,
): Promise<NextQuestion | null> {
  if (interview.turns.length >= TOTAL_QUESTIONS) return null;

  const queue = claimsInPlay(interview, claims);
  if (queue.length === 0) return null;

  const index = nextClaimIndex(interview.turns.length);
  if (index >= queue.length) return null;

  const claim = queue[index];
  const priorTurnsForClaim = interview.turns.filter((turn) => turn.claimId === claim.id);

  if (priorTurnsForClaim.length === 0) {
    const [question] = await generateQuestions(claim, { count: 1, pressure, targetRole });
    return { claimId: claim.id, question };
  }

  const followUp = await generateFollowUp(
    claim,
    priorTurnsForClaim.map((turn) => ({ question: turn.question, answer: turn.answer })),
    pressure,
  );
  return { claimId: claim.id, question: followUp };
}
