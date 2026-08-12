import { afterEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { getStore, setStore } from "@/lib/store";
import { ScoredClaim } from "@/lib/claims/schema";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

function claim(id: string): ScoredClaim {
  return {
    id,
    claim: "Reduced latency by 47%",
    sourceLine: "Reduced API latency by 47%",
    category: "impact",
    technologies: ["cache"],
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
    riskScore: 78,
    riskLevel: "HIGH",
    riskReasons: [],
    likelyQuestions: [],
  };
}

describe("MemoryStore", () => {
  it("round-trips an analysis", async () => {
    const store = new MemoryStore();
    const created = await store.createAnalysis({
      id: "a1",
      sessionId: "s1",
      filename: "resume.pdf",
      targetRole: "Staff Software Engineer",
      resumeText: "…",
      claims: [claim("c1")],
      defensibility: 62,
      model: "test",
    });

    expect(created.createdAt).toBeTruthy();
    await expect(store.getAnalysis("a1")).resolves.toMatchObject({ defensibility: 62 });
  });

  it("returns null for an unknown id", async () => {
    await expect(new MemoryStore().getAnalysis("nope")).resolves.toBeNull();
  });

  it("persists appended interview turns", async () => {
    const store = new MemoryStore();
    const interview = await store.createInterview({
      id: "i1",
      analysisId: "a1",
      sessionId: "s1",
      pressure: "aggressive",
      claimIds: ["c1"],
      pendingQuestion: { claimId: "c1", question: "What was the baseline?" },
    });

    expect(interview.turns).toEqual([]);

    interview.turns.push({
      claimId: "c1",
      question: "What was the baseline?",
      answer: "About 800ms at p99.",
      evaluation: {
        scores: {
          technicalDepth: 60,
          ownership: 60,
          metrics: 60,
          tradeoffs: 60,
          communication: 60,
          systemThinking: 60,
        },
        feedback: "ok",
        resumeIntegrityFlag: null,
        followUp: null,
      },
      askedAt: new Date().toISOString(),
    });
    interview.completedAt = new Date().toISOString();
    await store.saveInterview(interview);

    const reloaded = await store.getInterview("i1");
    expect(reloaded?.turns).toHaveLength(1);
    expect(reloaded?.completedAt).toBeTruthy();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    resetRateLimits();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(rateLimit("k", 3, 60_000).ok).toBe(true);
    }

    const blocked = rateLimit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys buckets independently", () => {
    resetRateLimits();
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
  });

  it("reopens the bucket after the window passes", () => {
    resetRateLimits();
    expect(rateLimit("w", 1, 1).ok).toBe(true);
    const start = Date.now();
    while (Date.now() === start) {
      /* wait out the 1ms window */
    }
    expect(rateLimit("w", 1, 1).ok).toBe(true);
  });
});

/**
 * Next compiles route handlers and server components into separate module
 * graphs, so a module-scoped `let` singleton is constructed once per graph.
 * That gave POST /api/analyze one MemoryStore and /r/[id] another, and every
 * report 404'd the instant it was created — in dev and in a production build.
 * Keeping the instance on globalThis is what makes the two sides agree.
 */
describe("store singleton", () => {
  const GLOBAL_KEY = "__resumeTruthCheckerStore";

  afterEach(() => setStore(null));

  it("returns the same instance across calls", () => {
    setStore(null);
    expect(getStore()).toBe(getStore());
  });

  it("keeps the instance on globalThis, not module scope", () => {
    setStore(null);
    const store = getStore();
    expect((globalThis as Record<string, unknown>)[GLOBAL_KEY]).toBe(store);
  });

  it("adopts an instance another module graph already created", () => {
    setStore(null);
    // Stand in for the copy of this module that the other graph loaded.
    const fromOtherGraph = new MemoryStore();
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = fromOtherGraph;

    expect(getStore()).toBe(fromOtherGraph);
  });

  it("clears cleanly for tests", () => {
    const first = getStore();
    setStore(null);
    expect(getStore()).not.toBe(first);
  });
});
