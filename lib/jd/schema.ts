import { z } from "zod";

export const IMPORTANCE_LEVELS = ["required", "preferred"] as const;
export type Importance = (typeof IMPORTANCE_LEVELS)[number];

export const COVERAGE_LEVELS = ["strong", "weak", "listed", "missing"] as const;
export type Coverage = (typeof COVERAGE_LEVELS)[number];

export const jdRequirementSchema = z.object({
  /** The capability itself, normalized to a noun: "Kubernetes", "distributed systems". */
  skill: z.string().min(2).max(60),
  importance: z.enum(IMPORTANCE_LEVELS),
  /** The line of the posting it came from, for the "why is this here" case. */
  sourceLine: z.string().min(1).max(400).default(""),
});

export type JdRequirement = z.infer<typeof jdRequirementSchema>;

/**
 * Same envelope tolerance as claim extraction: weak models return the bare
 * array about as often as the documented object.
 */
export const jdExtractionSchema = z.preprocess(
  (value) =>
    value !== null && typeof value === "object" && !("requirements" in value)
      ? { requirements: value }
      : value,
  z.object({ requirements: z.array(jdRequirementSchema).max(30) }),
);

export interface RequirementMatch {
  requirement: JdRequirement;
  coverage: Coverage;
  /**
   * Claims that evidence this requirement, riskiest first. Empty for a
   * "listed" match: the resume names the skill but no claim backs it.
   */
  claimIds: string[];
  /** 0-100. How well the covering claims would hold up if pressed here. */
  defensibility: number;
  /** 0-100. How likely this is to be where the interview hurts. */
  exposure: number;
}

/** A resume skill as the §21 bar chart shows it. */
export interface ResumeSkill {
  skill: string;
  claimCount: number;
  defensibility: number;
}

export interface JobMatch {
  role: string;
  jdText: string;
  requirements: RequirementMatch[];
  resumeSkills: ResumeSkill[];
  /** Requirement skills in the order the interview should attack them. */
  focus: string[];
  /** 0-100. Share of what the posting asks for that you can actually defend. */
  coverageScore: number;
  model: string;
  createdAt: string;
}
