import { z } from "zod";

export const CLAIM_CATEGORIES = [
  "impact",
  "scale",
  "technical",
  "ownership",
  "leadership",
  "innovation",
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const EVIDENCE_KINDS = [
  "baseline",
  "measurement_method",
  "timeframe",
  "traffic_volume",
  "personal_contribution",
  "team_size",
  "business_impact",
  "technical_design",
  "alternatives_considered",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * The observable properties of a claim. The model reports these; the risk score
 * is then computed from them in code, so scoring stays deterministic and
 * testable instead of asking a weak open model for a number it can't calibrate.
 */
export const claimSignalsSchema = z.object({
  quantified: z.boolean(),
  hasBaseline: z.boolean(),
  hasMeasurementMethod: z.boolean(),
  hasTimeframe: z.boolean(),
  ownership: z.enum(["individual", "shared", "ambiguous"]),
  scopeMagnitude: z.enum(["small", "medium", "large", "extreme"]),
  technicalSpecificity: z.enum(["low", "medium", "high"]),
});

export type ClaimSignals = z.infer<typeof claimSignalsSchema>;

export const extractedClaimSchema = z.object({
  /** The claim restated as a single assertion. */
  claim: z.string().min(4).max(300),
  /** The resume line it came from, verbatim, for the heatmap. */
  sourceLine: z.string().min(1).max(600),
  category: z.enum(CLAIM_CATEGORIES),
  technologies: z.array(z.string().max(60)).max(12).default([]),
  signals: claimSignalsSchema,
  evidenceRequired: z.array(z.enum(EVIDENCE_KINDS)).max(9).default([]),
  /** Short phrases: what an interviewer would find missing. */
  gaps: z.array(z.string().max(200)).max(8).default([]),
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;

/**
 * Weak models routinely drop the envelope and return the bare payload — asked
 * for {"claims":[...]} they emit [...] instead, and the repair prompt tends to
 * repeat the mistake rather than fix it. The envelope carries no information,
 * so accept either form rather than spending a second free-tier call arguing
 * about it.
 */
function unwrapped<K extends string, T extends z.ZodTypeAny>(key: K, inner: T) {
  return z.preprocess(
    (value) =>
      value !== null && typeof value === "object" && !(key in value)
        ? { [key]: value }
        : value,
    z.object({ [key]: inner } as { [P in K]: T }),
  );
}

export const extractionResponseSchema = unwrapped(
  "claims",
  z.array(extractedClaimSchema).max(40),
);

/** A claim after the risk engine has scored it and the store has given it an id. */
export interface ScoredClaim extends ExtractedClaim {
  id: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  /**
   * Pre-generated at analysis time for the riskiest claims, so the report shows
   * real interviewer questions the moment it loads. Empty for the long tail.
   */
  likelyQuestions: string[];
}

export const questionsResponseSchema = unwrapped(
  "questions",
  z.array(z.string().min(8).max(400)).min(1).max(8),
);

export const batchQuestionsResponseSchema = unwrapped(
  "questionsByClaim",
  z.record(z.string(), z.array(z.string().min(8).max(400)).max(8)),
);

/**
 * Collapse the near-misses weak models produce for a free-text field: an object
 * of sub-points where a sentence was asked for, or a list of them. The content
 * is right, only the container is wrong, and every one of these costs a
 * free-tier call to rediscover.
 */
function collapseToText(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === "string") return value;

  const parts =
    Array.isArray(value) ? value
    : typeof value === "object" ? Object.values(value)
    : [];

  const text = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();

  return text.length > 0 ? text : value;
}

/**
 * Over-length prose is truncated rather than rejected. These fields are
 * advisory — losing the tail of a sentence beats failing an interview turn the
 * candidate already answered.
 */
function prose(max: number) {
  return (value: unknown) => {
    const collapsed = collapseToText(value);
    return typeof collapsed === "string" && collapsed.length > max
      ? collapsed.slice(0, max)
      : collapsed;
  };
}

/** Models hand back "85" as often as 85, and occasionally 105. */
const scoreValue = z.preprocess(
  (value) => {
    const parsed = typeof value === "string" ? Number(value.trim()) : value;
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) return parsed;
    return Math.min(100, Math.max(0, parsed));
  },
  z.number().min(0).max(100),
);

export const answerEvaluationSchema = z.object({
  scores: z.object({
    technicalDepth: scoreValue,
    ownership: scoreValue,
    metrics: scoreValue,
    tradeoffs: scoreValue,
    communication: scoreValue,
    systemThinking: scoreValue,
  }),
  /** What the answer established, in the interviewer's words. */
  feedback: z.preprocess(prose(800), z.string().min(10)),
  /** Set when the answer reveals the resume line overstates what happened. */
  resumeIntegrityFlag: z.preprocess(prose(400), z.string().nullable().default(null)),
  followUp: z.preprocess(prose(400), z.string().nullable().default(null)),
});

export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;

export const SCORE_DIMENSIONS = [
  "technicalDepth",
  "ownership",
  "metrics",
  "tradeoffs",
  "communication",
  "systemThinking",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  technicalDepth: "Technical Depth",
  ownership: "Ownership",
  metrics: "Metrics",
  tradeoffs: "Tradeoffs",
  communication: "Communication",
  systemThinking: "System Thinking",
};

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  baseline: "Baseline",
  measurement_method: "Measurement methodology",
  timeframe: "Measurement period",
  traffic_volume: "Traffic volume",
  personal_contribution: "Your specific contribution",
  team_size: "Team size",
  business_impact: "Business impact",
  technical_design: "Technical design",
  alternatives_considered: "Alternatives considered",
};
