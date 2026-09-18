import { ScoredClaim } from "@/lib/claims/schema";
import { clamp } from "@/lib/claims/risk";
import {
  Coverage,
  Importance,
  JdRequirement,
  RequirementMatch,
  ResumeSkill,
} from "./schema";
import { mentions, normalizeSkill, sameSkill } from "./skills";

/**
 * The match is computed in code, like the risk engine (§10) — the model's only
 * job was reading requirements out of the posting. A skill match is a lookup,
 * not a judgement, and asking a free model to score one would make the result
 * unreproducible for no gain.
 *
 * The opinion encoded here, and the reason this isn't another keyword matcher:
 * a requirement you cover with an INDEFENSIBLE claim is more dangerous than one
 * you don't cover at all. A gap you can admit in one sentence; a claim that
 * collapses under three follow-ups is the §15 failure this whole product exists
 * to prevent.
 */

const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  required: 1,
  preferred: 0.6,
};

/**
 * "listed" sits just under "weak" rather than down with "missing", because a
 * skills line that nothing in the experience section backs is the §15 trap in
 * miniature: the resume got you the question, and there is no story behind it.
 */
const COVERAGE_WEIGHT: Record<Coverage, number> = {
  weak: 1,
  listed: 0.9,
  missing: 0.7,
  strong: 0.2,
};

/** Above this, the covering claims are solid enough not to lead the interview. */
const STRONG_DEFENSIBILITY = 60;

const COVERAGE_CREDIT: Record<Coverage, number> = {
  strong: 1,
  weak: 0.5,
  listed: 0.25,
  missing: 0,
};

export function matchRequirements(
  requirements: JdRequirement[],
  claims: ScoredClaim[],
  resumeText = "",
): RequirementMatch[] {
  return requirements.map((requirement) => {
    const covering = claimsFor(requirement.skill, claims);

    if (covering.length === 0) {
      // Extraction skips bare skill lists on purpose — a listed tool is not a
      // claim about anything. For coverage it still matters: saying "not on
      // your resume" about a word printed on the resume is simply wrong, and
      // the honest reading is that it is there with nothing behind it.
      const coverage: Coverage = mentions(resumeText, requirement.skill) ? "listed" : "missing";
      return {
        requirement,
        coverage,
        claimIds: [],
        defensibility: 0,
        exposure: exposureOf(requirement.importance, coverage),
      };
    }

    const defensibility = 100 - blendedRisk(covering);
    const coverage: Coverage = defensibility >= STRONG_DEFENSIBILITY ? "strong" : "weak";

    return {
      requirement,
      coverage,
      claimIds: [...covering]
        .sort((a, b) => b.riskScore - a.riskScore)
        .map((claim) => claim.id),
      defensibility,
      exposure: exposureOf(requirement.importance, coverage),
    };
  });
}

/**
 * A claim evidences a requirement if it tagged the technology, or if the claim
 * text talks about it. The second path matters more than the first: extraction
 * tags concrete tools, while postings ask for capabilities ("distributed
 * systems", "technical leadership") that live in the prose.
 */
function claimsFor(skill: string, claims: ScoredClaim[]): ScoredClaim[] {
  return claims.filter(
    (claim) =>
      claim.technologies.some((technology) => sameSkill(technology, skill)) ||
      mentions(`${claim.claim} ${claim.sourceLine}`, skill),
  );
}

/**
 * Same shape as §12's resume-level score: the average, pulled toward the worst.
 * An interviewer probing a skill can reach for any claim that mentions it, so
 * one indefensible claim taints a skill two solid ones would otherwise carry.
 */
function blendedRisk(claims: ScoredClaim[]): number {
  const scores = claims.map((claim) => claim.riskScore);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const worst = Math.max(...scores);
  return Math.round(mean * 0.6 + worst * 0.4);
}

function exposureOf(importance: Importance, coverage: Coverage): number {
  return Math.round(100 * IMPORTANCE_WEIGHT[importance] * COVERAGE_WEIGHT[coverage]);
}

/**
 * What the interview should open with. Ranked by exposure, and never padded
 * with the things you're already good at — a focus list that includes your
 * strengths is a focus list nobody reads.
 */
export function interviewFocus(matches: RequirementMatch[], count = 3): string[] {
  return [...matches]
    .filter((match) => match.coverage !== "strong")
    .sort((a, b) => b.exposure - a.exposure || a.requirement.skill.localeCompare(b.requirement.skill))
    .slice(0, count)
    .map((match) => match.requirement.skill);
}

/**
 * Claims to interview on, given a match. Claims evidencing the most exposed
 * requirements come first — that is the whole point of pointing the product at
 * a posting — and each is still the riskiest claim covering that requirement.
 */
export function claimsForFocus(
  matches: RequirementMatch[],
  claims: ScoredClaim[],
  count: number,
): string[] {
  const ordered = [...matches]
    .filter((match) => match.coverage === "weak")
    .sort((a, b) => b.exposure - a.exposure);

  const picked: string[] = [];
  for (const match of ordered) {
    for (const claimId of match.claimIds) {
      if (picked.length >= count) break;
      if (!picked.includes(claimId)) picked.push(claimId);
    }
  }

  // Pad with the riskiest remaining claims: a posting with few weak matches
  // shouldn't produce a two-question interview.
  if (picked.length < count) {
    for (const claim of [...claims].sort((a, b) => b.riskScore - a.riskScore)) {
      if (picked.length >= count) break;
      if (!picked.includes(claim.id)) picked.push(claim.id);
    }
  }

  return picked;
}

/**
 * §21's left-hand bars. Skills are read off the claims rather than off a skills
 * section, so the bar length means "how well can you defend this", not "how
 * many times did you type it".
 */
export function resumeSkills(claims: ScoredClaim[], count = 6): ResumeSkill[] {
  const groups = new Map<string, { label: string; claims: ScoredClaim[] }>();

  for (const claim of claims) {
    for (const technology of claim.technologies) {
      const key = normalizeSkill(technology);
      const group = groups.get(key) ?? { label: technology, claims: [] };
      group.claims.push(claim);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      skill: group.label,
      claimCount: group.claims.length,
      defensibility: 100 - blendedRisk(group.claims),
    }))
    .sort((a, b) => b.claimCount - a.claimCount || b.defensibility - a.defensibility)
    .slice(0, count);
}

/**
 * One number for the top of the page: the share of what this posting asks for
 * that you could defend today, weighted so a missing "required" costs more than
 * a missing "preferred".
 */
export function coverageScore(matches: RequirementMatch[]): number {
  if (matches.length === 0) return 0;

  let earned = 0;
  let available = 0;

  for (const match of matches) {
    const weight = IMPORTANCE_WEIGHT[match.requirement.importance];
    available += weight;
    // A weak match earns partial credit — you do have the experience, you just
    // can't yet prove it under questioning. A listed one earns a little: it is
    // on the page, which is worth something to a recruiter and nothing to an
    // interviewer.
    earned += weight * COVERAGE_CREDIT[match.coverage];
  }

  return clamp(Math.round((earned / available) * 100), 0, 100);
}
