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

export const extractionResponseSchema = z.object({
  claims: z.array(extractedClaimSchema).max(40),
});

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

export const questionsResponseSchema = z.object({
  questions: z.array(z.string().min(8).max(400)).min(1).max(8),
});

export const batchQuestionsResponseSchema = z.object({
  questionsByClaim: z.record(z.string(), z.array(z.string().min(8).max(400)).max(8)),
});

export const answerEvaluationSchema = z.object({
  scores: z.object({
    technicalDepth: z.number().min(0).max(100),
    ownership: z.number().min(0).max(100),
    metrics: z.number().min(0).max(100),
    tradeoffs: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    systemThinking: z.number().min(0).max(100),
  }),
  /** What the answer established, in the interviewer's words. */
  feedback: z.string().min(10).max(800),
  /** Set when the answer reveals the resume line overstates what happened. */
  resumeIntegrityFlag: z.string().max(400).nullable().default(null),
  followUp: z.string().max(400).nullable().default(null),
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
