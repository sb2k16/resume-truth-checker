import { describe, expect, it } from "vitest";
import { AnswerEvaluation, ScoredClaim } from "@/lib/claims/schema";
import { isNonAnswer, nonAnswerEvaluation } from "@/lib/interview/evaluate";
import { summarize } from "@/lib/interview/score";
import {
  QUESTIONS_PER_CLAIM,
  TOTAL_QUESTIONS,
  claimsInPlay,
  isComplete,
  nextClaimIndex,
} from "@/lib/interview/runner";
import { Interview } from "@/lib/store/types";

function evaluation(overrides: Partial<AnswerEvaluation["scores"]> = {}, flag: string | null = null): AnswerEvaluation {
  return {
    scores: {
      technicalDepth: 70,
      ownership: 70,
      metrics: 70,
      tradeoffs: 70,
      communication: 70,
      systemThinking: 70,
      ...overrides,
    },
    feedback: "An answer was given.",
    resumeIntegrityFlag: flag,
    followUp: null,
  };
}

function scoredClaim(id: string): ScoredClaim {
  return {
    id,
    claim: `claim ${id}`,
    sourceLine: `line ${id}`,
    category: "impact",
    technologies: [],
    signals: {
      quantified: true,
      hasBaseline: false,
      hasMeasurementMethod: false,
      hasTimeframe: false,
      ownership: "ambiguous",
      scopeMagnitude: "medium",
      technicalSpecificity: "medium",
    },
    evidenceRequired: ["baseline"],
    gaps: [],
    riskScore: 70,
    riskLevel: "HIGH",
    riskReasons: [],
    likelyQuestions: [],
  };
}

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "i1",
    analysisId: "a1",
    sessionId: "s1",
    pressure: "realistic",
    claimIds: ["c1", "c2", "c3"],
    turns: [],
    pendingQuestion: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("summarize", () => {
  it("returns an empty summary before any answers", () => {
    const summary = summarize([]);
    expect(summary.overall).toBe(0);
    expect(summary.answered).toBe(0);
    expect(summary.weakest).toBeNull();
  });

  it("averages each dimension across answers", () => {
    const summary = summarize([
      evaluation({ metrics: 40 }),
      evaluation({ metrics: 60 }),
    ]);
    expect(summary.dimensions.metrics).toBe(50);
    expect(summary.answered).toBe(2);
  });

  it("names the weakest and strongest dimensions", () => {
    const summary = summarize([evaluation({ metrics: 20, technicalDepth: 95 })]);
    expect(summary.weakest?.dimension).toBe("metrics");
    expect(summary.strongest?.dimension).toBe("technicalDepth");
    expect(summary.weakest?.note).toMatch(/measured/i);
  });

  it("weights ownership and depth above communication", () => {
    const weakOwnership = summarize([evaluation({ ownership: 10 })]);
    const weakCommunication = summarize([evaluation({ communication: 10 })]);
    expect(weakOwnership.overall).toBeLessThan(weakCommunication.overall);
  });

  it("collects integrity flags without repeating them", () => {
    const flag = "You wrote 'Led the migration' but described reviewing someone else's design.";
    const summary = summarize([evaluation({}, flag), evaluation({}, flag), evaluation()]);
    expect(summary.integrityFlags).toEqual([flag]);
  });

  it("stays inside 0-100 for a total failure", () => {
    const zeros = summarize([nonAnswerEvaluation(), nonAnswerEvaluation()]);
    expect(zeros.overall).toBe(0);
  });
});

describe("isNonAnswer", () => {
  it("catches empty and throwaway answers", () => {
    expect(isNonAnswer("")).toBe(true);
    expect(isNonAnswer("   ")).toBe(true);
    expect(isNonAnswer("idk")).toBe(true);
    expect(isNonAnswer("I don't know")).toBe(true);
    expect(isNonAnswer("n/a")).toBe(true);
  });

  it("lets a real attempt through", () => {
    expect(
      isNonAnswer("I don't know the exact p99, but the dashboard showed roughly 800ms before."),
    ).toBe(false);
  });

  it("scores a non-answer at zero without inventing feedback", () => {
    const result = nonAnswerEvaluation();
    expect(Object.values(result.scores).every((score) => score === 0)).toBe(true);
    expect(result.resumeIntegrityFlag).toBeNull();
  });
});

describe("interview runner", () => {
  it("spreads questions across claims two at a time", () => {
    expect(nextClaimIndex(0)).toBe(0);
    expect(nextClaimIndex(1)).toBe(0);
    expect(nextClaimIndex(2)).toBe(1);
    expect(nextClaimIndex(3)).toBe(1);
    expect(nextClaimIndex(4)).toBe(2);
    expect(QUESTIONS_PER_CLAIM).toBe(2);
  });

  it("resolves claim ids in queue order and drops unknown ones", () => {
    const claims = [scoredClaim("c3"), scoredClaim("c1")];
    const queue = claimsInPlay(interview({ claimIds: ["c1", "c9", "c3"] }), claims);
    expect(queue.map((claim) => claim.id)).toEqual(["c1", "c3"]);
  });

  it("is complete once the question budget is spent", () => {
    const turns = Array.from({ length: TOTAL_QUESTIONS }, () => ({
      claimId: "c1",
      question: "q",
      answer: "a",
      evaluation: evaluation(),
      askedAt: new Date().toISOString(),
    }));
    expect(isComplete(interview({ turns }))).toBe(true);
    expect(isComplete(interview())).toBe(false);
  });

  it("is complete once explicitly finished", () => {
    expect(isComplete(interview({ completedAt: new Date().toISOString() }))).toBe(true);
  });
});
