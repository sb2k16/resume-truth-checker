import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, parseJson } from "@/lib/llm/json";

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
