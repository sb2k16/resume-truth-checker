import { describe, expect, it } from "vitest";
import {
  assessRisk,
  defensibilityScore,
  percentile,
  riskiest,
  scoreClaims,
  toLevel,
} from "@/lib/claims/risk";
import { ClaimCategory, ClaimSignals, ExtractedClaim } from "@/lib/claims/schema";

function signals(overrides: Partial<ClaimSignals> = {}): ClaimSignals {
  return {
    quantified: false,
    hasBaseline: false,
    hasMeasurementMethod: false,
    hasTimeframe: false,
    ownership: "individual",
    scopeMagnitude: "small",
    technicalSpecificity: "high",
    ...overrides,
  };
}

function claim(
  category: ClaimCategory,
  overrides: Partial<ClaimSignals> = {},
  text = "a claim",
): ExtractedClaim {
  return {
    claim: text,
    sourceLine: text,
    category,
    technologies: [],
    signals: signals(overrides),
    evidenceRequired: [],
    gaps: [],
  };
}

/**
 * These four cases are the worked examples in §11 of the product spec. They pin
 * the weights: if someone retunes the risk engine and one of these moves band,
 * the product's own documentation has become wrong.
 */
describe("risk levels match the spec's worked examples", () => {
  it("rates a plain factual statement LOW", () => {
    // "Implemented a REST API using Java."
    const { level } = assessRisk("technical", signals({ technicalSpecificity: "high" }));
    expect(level).toBe("LOW");
  });

  it("rates a vague improvement MEDIUM", () => {
    // "Improved service reliability."
    const { level } = assessRisk(
      "impact",
      signals({ ownership: "ambiguous", technicalSpecificity: "low", scopeMagnitude: "medium" }),
    );
    expect(level).toBe("MEDIUM");
  });

  it("rates an unsupported quantitative claim HIGH", () => {
    // "Reduced infrastructure costs by 65%."
    const { level } = assessRisk(
      "impact",
      signals({
        quantified: true,
        scopeMagnitude: "large",
        technicalSpecificity: "medium",
      }),
    );
    expect(level).toBe("HIGH");
  });

  it("rates an organization-sized ownership claim VERY_HIGH", () => {
    // "Architected the company's distributed data platform."
    const { level } = assessRisk(
      "ownership",
      signals({ scopeMagnitude: "extreme", technicalSpecificity: "medium" }),
    );
    expect(level).toBe("VERY_HIGH");
  });
});

describe("assessRisk", () => {
  it("penalises a number with no baseline more than a number with one", () => {
    const withoutBaseline = assessRisk("impact", signals({ quantified: true }));
    const withBaseline = assessRisk(
      "impact",
      signals({
        quantified: true,
        hasBaseline: true,
        hasMeasurementMethod: true,
        hasTimeframe: true,
      }),
    );
    expect(withoutBaseline.score).toBeGreaterThan(withBaseline.score + 30);
  });

  it("treats ambiguous ownership as riskier than shared credit", () => {
    const ambiguous = assessRisk("impact", signals({ ownership: "ambiguous" }));
    const shared = assessRisk("impact", signals({ ownership: "shared" }));
    expect(ambiguous.score).toBeGreaterThan(shared.score);
    expect(ambiguous.reasons.join(" ")).toContain("team");
  });

  it("does not compound scope for shared credit on structural claims", () => {
    const individual = assessRisk("ownership", signals({ scopeMagnitude: "extreme" }));
    const shared = assessRisk(
      "ownership",
      signals({ scopeMagnitude: "extreme", ownership: "shared" }),
    );
    expect(individual.score - shared.score).toBeGreaterThan(12);
  });

  it("never leaves the 0-100 range", () => {
    const worst = assessRisk(
      "innovation",
      signals({
        quantified: true,
        ownership: "ambiguous",
        scopeMagnitude: "extreme",
        technicalSpecificity: "low",
      }),
    );
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.level).toBe("VERY_HIGH");
  });

  it("explains itself whenever it penalises", () => {
    const { reasons } = assessRisk(
      "impact",
      signals({ quantified: true, ownership: "ambiguous", technicalSpecificity: "low" }),
    );
    expect(reasons.length).toBeGreaterThanOrEqual(3);
    expect(reasons.every((reason) => reason.length > 10)).toBe(true);
  });
});

describe("toLevel", () => {
  it("maps band boundaries exactly", () => {
    expect(toLevel(24)).toBe("LOW");
    expect(toLevel(25)).toBe("MEDIUM");
    expect(toLevel(51)).toBe("MEDIUM");
    expect(toLevel(52)).toBe("HIGH");
    expect(toLevel(79)).toBe("HIGH");
    expect(toLevel(80)).toBe("VERY_HIGH");
  });
});

describe("scoreClaims", () => {
  it("assigns stable ids and surfaces model-spotted gaps first", () => {
    const scored = scoreClaims([
      { ...claim("impact", { quantified: true }), gaps: ["No baseline latency given"] },
      claim("technical"),
    ]);

    expect(scored.map((entry) => entry.id)).toEqual(["c1", "c2"]);
    expect(scored[0].riskReasons[0]).toBe("No baseline latency given");
    expect(scored[0].likelyQuestions).toEqual([]);
  });
});

describe("defensibilityScore", () => {
  it("returns 0 with no claims", () => {
    expect(defensibilityScore([])).toBe(0);
  });

  it("scores a resume of safe claims high", () => {
    const scored = scoreClaims([claim("technical"), claim("technical"), claim("technical")]);
    expect(defensibilityScore(scored)).toBeGreaterThan(75);
  });

  it("lets two indefensible claims drag down a pile of safe ones", () => {
    const safe = Array.from({ length: 8 }, () => claim("technical"));
    const reckless = claim("ownership", {
      quantified: true,
      ownership: "ambiguous",
      scopeMagnitude: "extreme",
      technicalSpecificity: "low",
    });

    const allSafe = defensibilityScore(scoreClaims(safe));
    const mixed = defensibilityScore(scoreClaims([...safe, reckless, reckless]));

    expect(allSafe - mixed).toBeGreaterThan(15);
  });
});

describe("percentile", () => {
  it("interpolates between neighbours", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 50, 100], 0.9)).toBe(90);
    expect(percentile([42], 0.9)).toBe(42);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("riskiest", () => {
  it("returns the highest scores first and respects the cap", () => {
    const scored = scoreClaims([
      claim("technical", {}, "low"),
      claim("ownership", { scopeMagnitude: "extreme" }, "high"),
      claim("impact", { quantified: true }, "medium"),
    ]);

    const top = riskiest(scored, 2);
    expect(top).toHaveLength(2);
    expect(top[0].riskScore).toBeGreaterThanOrEqual(top[1].riskScore);
    expect(top[0].claim).toBe("high");
  });
});
