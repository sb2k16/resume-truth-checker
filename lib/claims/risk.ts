import {
  ClaimCategory,
  ClaimSignals,
  ExtractedClaim,
  RiskLevel,
  ScoredClaim,
} from "./schema";

/**
 * Risk here means "how hard will this be to defend under questioning", not
 * "how likely is this to be a lie". A precise, well-scoped claim scores low
 * even when it is impressive; a vague one scores high even when it is true.
 *
 * The weights below are calibrated against the four worked examples in the
 * product spec (§11) — see risk.test.ts, which pins them.
 */

const CATEGORY_BASE: Record<ClaimCategory, number> = {
  technical: 10,
  leadership: 15,
  impact: 20,
  scale: 22,
  ownership: 28,
  innovation: 28,
};

const SCOPE_WEIGHT: Record<ClaimSignals["scopeMagnitude"], number> = {
  small: 0,
  medium: 6,
  large: 12,
  extreme: 28,
};

const OWNERSHIP_WEIGHT: Record<ClaimSignals["ownership"], number> = {
  shared: 2,
  individual: 8,
  ambiguous: 14,
};

const SPECIFICITY_WEIGHT: Record<ClaimSignals["technicalSpecificity"], number> = {
  high: 0,
  medium: 4,
  low: 10,
};

/** Structural claims compound with scope: "I architected the whole platform". */
const STRUCTURAL_CATEGORIES: ReadonlySet<ClaimCategory> = new Set([
  "ownership",
  "leadership",
  "innovation",
]);

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export function assessRisk(
  category: ClaimCategory,
  signals: ClaimSignals,
): RiskAssessment {
  const reasons: string[] = [];
  let score = CATEGORY_BASE[category];

  if (signals.quantified) {
    if (!signals.hasBaseline) {
      score += 18;
      reasons.push("States a number with no baseline to compare against");
    }
    if (!signals.hasMeasurementMethod) {
      score += 10;
      reasons.push("Doesn't say how the number was measured");
    }
    if (!signals.hasTimeframe) {
      score += 6;
      reasons.push("No measurement period given");
    }
  }

  score += OWNERSHIP_WEIGHT[signals.ownership];
  if (signals.ownership === "ambiguous") {
    reasons.push("Unclear what you did versus what the team did");
  }

  score += SCOPE_WEIGHT[signals.scopeMagnitude];
  if (signals.scopeMagnitude === "extreme") {
    reasons.push("Claims scope large enough that an interviewer will test it");
  }

  score += SPECIFICITY_WEIGHT[signals.technicalSpecificity];
  if (signals.technicalSpecificity === "low") {
    reasons.push("Too vague to evaluate without follow-up questions");
  }

  const bigScope =
    signals.scopeMagnitude === "large" || signals.scopeMagnitude === "extreme";
  if (
    STRUCTURAL_CATEGORIES.has(category) &&
    bigScope &&
    signals.ownership !== "shared"
  ) {
    score += 12;
    reasons.push("Takes personal credit for something organization-sized");
  }

  const bounded = clamp(Math.round(score), 0, 100);
  return { score: bounded, level: toLevel(bounded), reasons };
}

export function toLevel(score: number): RiskLevel {
  if (score < 25) return "LOW";
  if (score < 52) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "VERY_HIGH";
}

export function scoreClaims(claims: ExtractedClaim[], idPrefix = "c"): ScoredClaim[] {
  return claims.map((claim, index) => {
    const assessment = assessRisk(claim.category, claim.signals);
    return {
      ...claim,
      id: `${idPrefix}${index + 1}`,
      riskScore: assessment.score,
      riskLevel: assessment.level,
      // Gaps the model spotted come first; they are claim-specific and read
      // better than the generic structural reasons.
      riskReasons: [...claim.gaps, ...assessment.reasons].slice(0, 6),
      likelyQuestions: [],
    };
  });
}

/**
 * Resume-level defensibility. The mean alone lets a wall of safe "Implemented
 * X" bullets hide two indefensible headline claims, so the worst claims carry
 * extra weight — those are the ones an interviewer opens with.
 */
export function defensibilityScore(claims: ScoredClaim[]): number {
  if (claims.length === 0) return 0;

  const scores = claims.map((claim) => claim.riskScore).sort((a, b) => a - b);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const worst = percentile(scores, 0.9);

  return clamp(Math.round(100 - (mean * 0.7 + worst * 0.3)), 0, 100);
}

/** Linear-interpolated percentile over an ascending array. */
export function percentile(ascending: number[], fraction: number): number {
  if (ascending.length === 0) return 0;
  if (ascending.length === 1) return ascending[0];

  const position = (ascending.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ascending[lower];
  return ascending[lower] + (ascending[upper] - ascending[lower]) * (position - lower);
}

export function riskiest(claims: ScoredClaim[], count: number): ScoredClaim[] {
  return [...claims].sort((a, b) => b.riskScore - a.riskScore).slice(0, count);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
