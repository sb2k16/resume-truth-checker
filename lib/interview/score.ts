import {
  AnswerEvaluation,
  DIMENSION_LABELS,
  SCORE_DIMENSIONS,
  ScoreDimension,
} from "@/lib/claims/schema";
import { clamp } from "@/lib/claims/risk";

export type DimensionScores = Record<ScoreDimension, number>;

export interface InterviewSummary {
  overall: number;
  dimensions: DimensionScores;
  strongest: { dimension: ScoreDimension; score: number; note: string } | null;
  weakest: { dimension: ScoreDimension; score: number; note: string } | null;
  integrityFlags: string[];
  answered: number;
}

/**
 * Dimensions are not equally load-bearing for "can you defend this". Being
 * unable to say what you personally did sinks a claim faster than a slightly
 * unstructured explanation does.
 */
const DIMENSION_WEIGHT: Record<ScoreDimension, number> = {
  technicalDepth: 1.2,
  ownership: 1.2,
  metrics: 1.1,
  tradeoffs: 1,
  communication: 0.8,
  systemThinking: 0.9,
};

const WEAKNESS_NOTES: Record<ScoreDimension, string> = {
  technicalDepth:
    "You can state what was built but not how it worked. Interviewers read that as distance from the implementation.",
  ownership:
    "Your answers don't separate your work from the team's. That is the single fastest way for a strong claim to lose its force.",
  metrics:
    "You understand the work but struggle to explain how the impact was measured. Every number on your resume needs a baseline, a method, and a period.",
  tradeoffs:
    "You explain what you chose but not what you rejected. Senior interviews are largely about the alternatives you considered.",
  communication:
    "The substance is there but the answers wander. Lead with the outcome, then the mechanism.",
  systemThinking:
    "You describe your component in isolation. Connect it to the system around it — upstream load, failure modes, blast radius.",
};

const STRENGTH_NOTES: Record<ScoreDimension, string> = {
  technicalDepth: "You clearly understand how the systems you worked on actually function.",
  ownership: "You draw a clean line between your own contribution and the team's.",
  metrics: "You can substantiate your numbers with baselines and measurement methods.",
  tradeoffs: "You clearly understand the tradeoffs behind the decisions you made.",
  communication: "Your answers are structured and easy to follow under pressure.",
  systemThinking: "You reason about your work in the context of the wider system.",
};

export function summarize(evaluations: AnswerEvaluation[]): InterviewSummary {
  const answered = evaluations.length;

  if (answered === 0) {
    return {
      overall: 0,
      dimensions: blankDimensions(),
      strongest: null,
      weakest: null,
      integrityFlags: [],
      answered: 0,
    };
  }

  const dimensions = {} as DimensionScores;
  for (const dimension of SCORE_DIMENSIONS) {
    const total = evaluations.reduce(
      (sum, evaluation) => sum + evaluation.scores[dimension],
      0,
    );
    dimensions[dimension] = Math.round(total / answered);
  }

  const weightTotal = SCORE_DIMENSIONS.reduce(
    (sum, dimension) => sum + DIMENSION_WEIGHT[dimension],
    0,
  );
  const weighted = SCORE_DIMENSIONS.reduce(
    (sum, dimension) => sum + dimensions[dimension] * DIMENSION_WEIGHT[dimension],
    0,
  );

  const ranked = [...SCORE_DIMENSIONS].sort((a, b) => dimensions[b] - dimensions[a]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const integrityFlags = evaluations
    .map((evaluation) => evaluation.resumeIntegrityFlag)
    .filter((flag): flag is string => Boolean(flag && flag.trim()));

  return {
    overall: clamp(Math.round(weighted / weightTotal), 0, 100),
    dimensions,
    strongest: { dimension: best, score: dimensions[best], note: STRENGTH_NOTES[best] },
    weakest: { dimension: worst, score: dimensions[worst], note: WEAKNESS_NOTES[worst] },
    integrityFlags: dedupeFlags(integrityFlags),
    answered,
  };
}

export function dimensionLabel(dimension: ScoreDimension): string {
  return DIMENSION_LABELS[dimension];
}

function blankDimensions(): DimensionScores {
  const dimensions = {} as DimensionScores;
  for (const dimension of SCORE_DIMENSIONS) dimensions[dimension] = 0;
  return dimensions;
}

function dedupeFlags(flags: string[]): string[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = flag.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
