import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoredClaim, rewriteSuggestionSchema } from "@/lib/claims/schema";
import { InventedNumberError, inventedNumbers, suggestRewrite } from "@/lib/claims/rewrite";
import { resetLlmCache } from "@/lib/llm";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-key";
  process.env.LLM_MODELS = "groq:test-model";
  resetLlmCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetLlmCache();
});

function claim(overrides: Partial<ScoredClaim> = {}): ScoredClaim {
  return {
    id: "c1",
    claim: "Reduced API latency by 47%.",
    sourceLine: "Reduced API latency by 47%.",
    category: "impact",
    technologies: [],
    signals: {
      quantified: true,
      hasBaseline: false,
      hasMeasurementMethod: false,
      hasTimeframe: false,
      ownership: "ambiguous",
      scopeMagnitude: "medium",
      technicalSpecificity: "low",
    },
    evidenceRequired: ["baseline"],
    gaps: [],
    riskScore: 78,
    riskLevel: "HIGH",
    riskReasons: ["States a number with no baseline to compare against"],
    likelyQuestions: [],
    ...overrides,
  };
}

function modelReplies(...payloads: string[]) {
  const fetchMock = vi.fn();
  for (const payload of payloads) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: payload } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("inventedNumbers", () => {
  it("passes a rewrite that keeps the figure already on the resume", () => {
    expect(
      inventedNumbers(claim(), "Reduced API latency by 47% after redesigning the cache."),
    ).toEqual([]);
  });

  it("passes a rewrite that drops the figure entirely — the §20 fix", () => {
    expect(
      inventedNumbers(
        claim(),
        "Redesigned the caching layer, reducing API latency substantially under production workloads.",
      ),
    ).toEqual([]);
  });

  it("catches a figure the candidate never wrote", () => {
    expect(inventedNumbers(claim(), "Cut p99 latency from 800ms to 420ms.")).toEqual([
      "800",
      "420",
    ]);
  });

  it("catches a number swapped for a different one", () => {
    expect(inventedNumbers(claim(), "Reduced API latency by 40%.")).toEqual(["40%"]);
  });

  it("treats thousands separators and percent signs as the same figure", () => {
    const line = claim({
      claim: "Handled 1,200 requests per second.",
      sourceLine: "Handled 1,200 requests per second.",
    });
    expect(inventedNumbers(line, "Handled 1200 requests per second at peak.")).toEqual([]);
  });

  it("allows a spelled-out number to be written as a digit", () => {
    const line = claim({
      claim: "Mentored three junior engineers.",
      sourceLine: "Mentored three junior engineers.",
    });
    expect(inventedNumbers(line, "Mentored 3 junior engineers through ramp-up.")).toEqual([]);
  });

  it("reports each invented figure once", () => {
    expect(inventedNumbers(claim(), "Cut latency 40% in week one and held 40% after.")).toEqual([
      "40%",
    ]);
  });
});

describe("suggestRewrite", () => {
  it("returns the suggestion when no figure was invented", async () => {
    modelReplies(
      JSON.stringify({
        rewrite: "Redesigned the caching layer, measurably reducing API latency in production.",
        rationale: "Removes the unsupported percentage while keeping the achievement.",
        prepare: ["The p99 latency dashboard from before the change"],
      }),
    );

    const suggestion = await suggestRewrite(claim());
    expect(suggestion.rewrite).toContain("caching layer");
    expect(suggestion.prepare).toHaveLength(1);
  });

  it("repairs a rewrite that fabricated a figure", async () => {
    const fetchMock = modelReplies(
      JSON.stringify({
        rewrite: "Cut API latency from 800ms to 420ms.",
        rationale: "Adds the detail an interviewer wants.",
        prepare: [],
      }),
      JSON.stringify({
        rewrite: "Reduced API latency through a caching redesign.",
        rationale: "States only what the resume supports.",
        prepare: ["The baseline latency figure"],
      }),
    );

    const suggestion = await suggestRewrite(claim());
    expect(suggestion.rewrite).not.toMatch(/800|420/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The repair turn must name the offending figures back to the model.
    const repairBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(JSON.stringify(repairBody.messages)).toContain("800");
  });

  it("throws rather than print a rewrite that invents a figure twice", async () => {
    modelReplies(
      JSON.stringify({ rewrite: "Cut latency to 420ms.", rationale: "Sharper and more specific.", prepare: [] }),
      JSON.stringify({ rewrite: "Cut latency to 300ms.", rationale: "Sharper and more specific.", prepare: [] }),
    );

    await expect(suggestRewrite(claim())).rejects.toBeInstanceOf(InventedNumberError);
  });
});

describe("rewriteSuggestionSchema", () => {
  it("collapses an object handed to a prose field", () => {
    const parsed = rewriteSuggestionSchema.parse({
      rewrite: { part1: "Redesigned the caching layer,", part2: "reducing latency." },
      rationale: ["Removes the unsupported number."],
      prepare: [],
    });
    expect(parsed.rewrite).toBe("Redesigned the caching layer, reducing latency.");
    expect(parsed.rationale).toBe("Removes the unsupported number.");
  });

  it("defaults a missing prepare list", () => {
    const parsed = rewriteSuggestionSchema.parse({
      rewrite: "Redesigned the caching layer.",
      rationale: "States only what is supported.",
    });
    expect(parsed.prepare).toEqual([]);
  });
});
