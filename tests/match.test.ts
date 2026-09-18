import { describe, expect, it } from "vitest";
import { ScoredClaim } from "@/lib/claims/schema";
import { mentions, normalizeSkill, sameSkill } from "@/lib/jd/skills";
import {
  claimsForFocus,
  coverageScore,
  interviewFocus,
  matchRequirements,
  resumeSkills,
} from "@/lib/jd/match";
import { JdRequirement } from "@/lib/jd/schema";

function claim(overrides: Partial<ScoredClaim> & { id: string }): ScoredClaim {
  return {
    claim: "Did a thing.",
    sourceLine: "Did a thing.",
    category: "impact",
    technologies: [],
    signals: {
      quantified: false,
      hasBaseline: false,
      hasMeasurementMethod: false,
      hasTimeframe: false,
      ownership: "individual",
      scopeMagnitude: "medium",
      technicalSpecificity: "medium",
    },
    evidenceRequired: [],
    gaps: [],
    riskScore: 50,
    riskLevel: "MEDIUM",
    riskReasons: [],
    likelyQuestions: [],
    ...overrides,
  };
}

function requirement(skill: string, importance: JdRequirement["importance"] = "required"): JdRequirement {
  return { skill, importance, sourceLine: `Experience with ${skill}` };
}

describe("normalizeSkill", () => {
  it("resolves the aliases that actually collide on resumes", () => {
    expect(normalizeSkill("React.js")).toBe("react");
    expect(normalizeSkill("Postgres")).toBe("postgresql");
    expect(normalizeSkill("K8s")).toBe("kubernetes");
    expect(normalizeSkill("GCP")).toBe("googlecloud");
  });

  it("keeps the punctuation that is part of a language name", () => {
    expect(normalizeSkill("C++")).toBe("c++");
    expect(normalizeSkill("C#")).toBe("c#");
  });

  it("passes an unknown skill through rather than dropping it", () => {
    expect(normalizeSkill("Erlang")).toBe("erlang");
  });
});

describe("sameSkill", () => {
  it("treats singular and plural as one skill", () => {
    expect(sameSkill("distributed system", "distributed systems")).toBe(true);
    expect(sameSkill("microservice", "microservices")).toBe(true);
  });

  it("does not treat a short name ending in s as a plural", () => {
    expect(sameSkill("AWS", "AW")).toBe(false);
    expect(sameSkill("Go", "Gos")).toBe(false);
  });
});

describe("mentions", () => {
  it("finds a capability stated in prose rather than tagged", () => {
    expect(
      mentions("Designed a distributed ingestion platform.", "distributed systems"),
    ).toBe(true);
  });

  it("does not match a substring inside another word", () => {
    expect(mentions("Worked on the goal-setting tool.", "Go")).toBe(false);
  });

  it("finds an alias of the skill", () => {
    expect(mentions("Ran the k8s migration.", "Kubernetes")).toBe(true);
  });

  it("bridges the posting's noun to the resume's", () => {
    // A posting says "distributed systems"; a resume says "platform". Demanding
    // the posting's exact noun is how matchers invent gaps that aren't there.
    expect(mentions("Designed a distributed ingestion platform.", "distributed systems")).toBe(
      true,
    );
    expect(mentions("Led migration of four teams.", "leadership")).toBe(true);
  });

  it("still needs the modifier, not just the head noun", () => {
    expect(mentions("Implemented Java services for the control plane.", "distributed systems")).toBe(
      false,
    );
  });
});

describe("matchRequirements", () => {
  const defensible = claim({
    id: "c1",
    claim: "Built Kubernetes autoscaling for the ingestion fleet.",
    technologies: ["Kubernetes"],
    riskScore: 20,
    riskLevel: "LOW",
  });

  const shaky = claim({
    id: "c2",
    claim: "Architected the company's distributed data platform.",
    sourceLine: "Architected the company's distributed data platform.",
    riskScore: 88,
    riskLevel: "VERY_HIGH",
  });

  it("marks a requirement backed by a defensible claim as strong", () => {
    const [match] = matchRequirements([requirement("Kubernetes")], [defensible]);
    expect(match.coverage).toBe("strong");
    expect(match.claimIds).toEqual(["c1"]);
  });

  it("marks a requirement backed only by an indefensible claim as weak", () => {
    const [match] = matchRequirements([requirement("distributed systems")], [shaky]);
    expect(match.coverage).toBe("weak");
    expect(match.defensibility).toBeLessThan(60);
  });

  it("marks a requirement with no backing claim as missing", () => {
    const [match] = matchRequirements([requirement("Rust")], [defensible, shaky]);
    expect(match.coverage).toBe("missing");
    expect(match.claimIds).toEqual([]);
  });

  it("separates a skill listed on the resume from one that isn't there at all", () => {
    // Extraction skips the skills line, so neither is backed by a claim — but
    // telling someone Kafka is "not on your resume" when it is printed on it is
    // just wrong, and the two cases deserve different advice.
    const resume = "Skills: Java, Kafka, OpenSearch, AWS, Terraform";
    const [kafka, rust] = matchRequirements(
      [requirement("Kafka"), requirement("Rust")],
      [defensible],
      resume,
    );

    expect(kafka.coverage).toBe("listed");
    expect(rust.coverage).toBe("missing");
    expect(kafka.exposure).toBeGreaterThan(rust.exposure);
  });

  it("finds a capability behind an emphasis adjective", () => {
    const led = claim({
      id: "c9",
      claim: "Led migration of four teams to a new deployment pipeline.",
      sourceLine: "Led migration of four teams to a new deployment pipeline.",
      riskScore: 51,
    });
    const [match] = matchRequirements([requirement("technical leadership")], [led]);
    expect(match.coverage).not.toBe("missing");
  });

  it("lets one indefensible claim pull down a skill two solid ones cover", () => {
    const solid = claim({ id: "c3", technologies: ["Kafka"], riskScore: 15 });
    const alsoSolid = claim({ id: "c4", technologies: ["Kafka"], riskScore: 20 });
    const risky = claim({ id: "c5", technologies: ["Kafka"], riskScore: 90 });

    const [clean] = matchRequirements([requirement("Kafka")], [solid, alsoSolid]);
    const [tainted] = matchRequirements([requirement("Kafka")], [solid, alsoSolid, risky]);

    expect(clean.coverage).toBe("strong");
    expect(tainted.defensibility).toBeLessThan(clean.defensibility);
  });

  it("ranks a required gap above a preferred one", () => {
    const [needed, nice] = matchRequirements(
      [requirement("Rust"), requirement("Elixir", "preferred")],
      [],
    );
    expect(needed.exposure).toBeGreaterThan(nice.exposure);
  });
});

describe("interviewFocus", () => {
  it("puts an undefended requirement above one you don't have at all", () => {
    const claims = [
      claim({
        id: "c1",
        claim: "Architected the company's distributed data platform.",
        sourceLine: "Architected the company's distributed data platform.",
        riskScore: 88,
      }),
    ];
    const matches = matchRequirements(
      [requirement("distributed systems"), requirement("Rust")],
      claims,
    );

    // The product's opinion: a claim that collapses hurts more than a gap you
    // can admit in one sentence.
    expect(interviewFocus(matches)[0]).toBe("distributed systems");
  });

  it("never pads the list with things you're already good at", () => {
    const claims = [claim({ id: "c1", technologies: ["Kubernetes"], riskScore: 12 })];
    const matches = matchRequirements([requirement("Kubernetes")], claims);
    expect(interviewFocus(matches)).toEqual([]);
  });
});

describe("claimsForFocus", () => {
  it("leads with claims behind the most exposed requirements", () => {
    const claims = [
      claim({ id: "c1", technologies: ["Terraform"], riskScore: 70 }),
      claim({ id: "c2", technologies: ["Kafka"], riskScore: 65 }),
      claim({ id: "c3", technologies: ["React"], riskScore: 95 }),
    ];
    const matches = matchRequirements(
      [requirement("Kafka"), requirement("React", "preferred")],
      claims,
    );

    // c3 is the riskiest claim outright, but Kafka is a required gap and React
    // is only preferred — the posting decides the order now.
    expect(claimsForFocus(matches, claims, 3)[0]).toBe("c2");
  });

  it("pads with the riskiest claims when the posting has few weak matches", () => {
    const claims = [
      claim({ id: "c1", riskScore: 30 }),
      claim({ id: "c2", riskScore: 90 }),
      claim({ id: "c3", riskScore: 80 }),
    ];
    const picked = claimsForFocus(matchRequirements([requirement("Rust")], claims), claims, 3);
    expect(picked).toEqual(["c2", "c3", "c1"]);
  });
});

describe("coverageScore", () => {
  it("scores a clean match at 100 and an empty one at 0", () => {
    const covered = [claim({ id: "c1", technologies: ["Kubernetes"], riskScore: 10 })];
    expect(coverageScore(matchRequirements([requirement("Kubernetes")], covered))).toBe(100);
    expect(coverageScore(matchRequirements([requirement("Rust")], covered))).toBe(0);
  });

  it("scores a listed-only skill below a weak one and above a gap", () => {
    const claims = [claim({ id: "c1", technologies: ["Kubernetes"], riskScore: 10 })];
    const listed = coverageScore(
      matchRequirements([requirement("Kafka")], claims, "Skills: Kafka"),
    );
    const missing = coverageScore(matchRequirements([requirement("Kafka")], claims, ""));

    expect(listed).toBe(25);
    expect(missing).toBe(0);
  });

  it("gives a weak match partial credit — you have it, you just can't prove it", () => {
    const shaky = [
      claim({
        id: "c1",
        claim: "Architected the company's distributed data platform.",
        sourceLine: "Architected the company's distributed data platform.",
        riskScore: 88,
      }),
    ];
    const score = coverageScore(matchRequirements([requirement("distributed systems")], shaky));
    expect(score).toBe(50);
  });

  it("returns 0 for a posting with no requirements rather than dividing by zero", () => {
    expect(coverageScore([])).toBe(0);
  });
});

describe("resumeSkills", () => {
  it("ranks by evidence count, and scores by defensibility", () => {
    const claims = [
      claim({ id: "c1", technologies: ["Kafka", "AWS"], riskScore: 20 }),
      claim({ id: "c2", technologies: ["Kafka"], riskScore: 30 }),
    ];
    const [top] = resumeSkills(claims);
    expect(top.skill).toBe("Kafka");
    expect(top.claimCount).toBe(2);
    expect(top.defensibility).toBeGreaterThan(60);
  });

  it("folds alias spellings into one bar", () => {
    const claims = [
      claim({ id: "c1", technologies: ["Postgres"] }),
      claim({ id: "c2", technologies: ["PostgreSQL"] }),
    ];
    expect(resumeSkills(claims)).toHaveLength(1);
  });
});
