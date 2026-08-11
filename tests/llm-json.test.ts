import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, parseJson } from "@/lib/llm/json";
import {
  answerEvaluationSchema,
  batchQuestionsResponseSchema,
  extractionResponseSchema,
  questionsResponseSchema,
} from "@/lib/claims/schema";

/**
 * Every case here is a shape a free open-weight model actually produced during
 * development. The recovery logic exists because these are routine, not rare.
 */
describe("extractJson", () => {
  it("parses clean JSON", () => {
    expect(extractJson('{"claims":[]}')).toEqual({ claims: [] });
  });

  it("unwraps a markdown fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("unwraps an unlabelled fence", () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("skips a conversational preamble", () => {
    expect(extractJson('Here is the analysis:\n\n{"a":1}')).toEqual({ a: 1 });
  });

  it("ignores trailing commentary", () => {
    expect(extractJson('{"a":1}\n\nLet me know if you want more detail.')).toEqual({ a: 1 });
  });

  it("handles a top-level array", () => {
    expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("does not truncate on braces inside strings", () => {
    const raw = 'Result: {"claim":"Reduced p99 {latency} by 40%","ok":true}';
    expect(extractJson(raw)).toEqual({ claim: "Reduced p99 {latency} by 40%", ok: true });
  });

  it("does not truncate on an escaped quote inside a string", () => {
    const raw = '{"claim":"He said \\"it scaled\\" in review"}';
    expect(extractJson(raw)).toEqual({ claim: 'He said "it scaled" in review' });
  });

  it("throws with a usable excerpt when there is no JSON at all", () => {
    expect(() => extractJson("I cannot help with that request.")).toThrow(/did not return JSON/);
  });
});

describe("parseJson", () => {
  const schema = z.object({ questions: z.array(z.string()) });

  it("validates against the schema", () => {
    expect(parseJson('```json\n{"questions":["What was the baseline?"]}\n```', schema)).toEqual({
      questions: ["What was the baseline?"],
    });
  });

  it("rejects a well-formed object of the wrong shape", () => {
    expect(() => parseJson('{"questions":"nope"}', schema)).toThrow();
  });
});

/**
 * qwen2.5-coder returned a bare array where the prompt asked for
 * {"claims":[...]}, and answered the repair prompt with the same bare array.
 * The envelope carries no information, so both forms are accepted.
 */
describe("dropped response envelopes", () => {
  const claim = {
    claim: "Reduced API latency by 47%",
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
    gaps: ["No baseline latency given"],
  };

  it("accepts claims wrapped in the envelope", () => {
    const parsed = extractionResponseSchema.parse({ claims: [claim] });
    expect(parsed.claims).toHaveLength(1);
  });

  it("accepts a bare array of claims", () => {
    const parsed = extractionResponseSchema.parse([claim]);
    expect(parsed.claims[0].claim).toBe("Reduced API latency by 47%");
  });

  it("accepts a bare array of questions", () => {
    const parsed = questionsResponseSchema.parse(["What was the baseline p99 latency?"]);
    expect(parsed.questions).toEqual(["What was the baseline p99 latency?"]);
  });

  it("accepts batch questions keyed directly by claim id", () => {
    const parsed = batchQuestionsResponseSchema.parse({
      c1: ["What was the baseline p99 latency?"],
    });
    expect(parsed.questionsByClaim.c1).toHaveLength(1);
  });

  it("still rejects a payload that is wrong beyond the envelope", () => {
    expect(() => extractionResponseSchema.parse([{ claim: "too short on fields" }])).toThrow();
  });
});

/**
 * The evaluation schema takes the most abuse: it has free-text fields, a
 * nullable one, and six numbers, and a turn that fails here throws away an
 * answer the candidate already typed.
 */
describe("answer evaluation near-misses", () => {
  const base = {
    scores: {
      technicalDepth: 60,
      ownership: 40,
      metrics: 20,
      tradeoffs: 50,
      communication: 70,
      systemThinking: 55,
    },
    feedback: "You described the change but not how the improvement was measured.",
    resumeIntegrityFlag: null,
    followUp: null,
  };

  it("collapses an object given where a sentence was asked for", () => {
    // qwen2.5-coder answered resumeIntegrityFlag with a small object.
    const parsed = answerEvaluationSchema.parse({
      ...base,
      resumeIntegrityFlag: {
        mismatch: "You said the team measured it.",
        suggestion: "Consider wording that reflects your own contribution.",
      },
    });
    expect(parsed.resumeIntegrityFlag).toBe(
      "You said the team measured it. Consider wording that reflects your own contribution.",
    );
  });

  it("collapses a list of points into one string", () => {
    const parsed = answerEvaluationSchema.parse({
      ...base,
      followUp: ["What was the baseline?", "Who ran the measurement?"],
    });
    expect(parsed.followUp).toBe("What was the baseline? Who ran the measurement?");
  });

  it("keeps a null flag null", () => {
    expect(answerEvaluationSchema.parse(base).resumeIntegrityFlag).toBeNull();
  });

  it("truncates over-length prose instead of failing the turn", () => {
    const parsed = answerEvaluationSchema.parse({ ...base, feedback: "x".repeat(1200) });
    expect(parsed.feedback).toHaveLength(800);
  });

  it("accepts numeric scores sent as strings, and clamps out-of-range ones", () => {
    const parsed = answerEvaluationSchema.parse({
      ...base,
      scores: { ...base.scores, technicalDepth: "85", ownership: 105, metrics: -10 },
    });
    expect(parsed.scores.technicalDepth).toBe(85);
    expect(parsed.scores.ownership).toBe(100);
    expect(parsed.scores.metrics).toBe(0);
  });

  it("still rejects a score that is not a number at all", () => {
    expect(() =>
      answerEvaluationSchema.parse({
        ...base,
        scores: { ...base.scores, technicalDepth: "excellent" },
      }),
    ).toThrow();
  });
});
