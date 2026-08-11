import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmUnavailableError, complete, modelChain, resetLlmCache } from "@/lib/llm";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  resetLlmCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetLlmCache();
});

function jsonResponse(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("modelChain", () => {
  it("drops providers with no credentials", () => {
    process.env.OPENROUTER_API_KEY = "";
    process.env.GROQ_API_KEY = "";
    delete process.env.LLM_MODELS;
    resetLlmCache();

    // Ollama needs no key, so it survives; the hosted providers do not.
    expect(modelChain().every((target) => target.provider === "ollama")).toBe(true);
  });

  it("honours an LLM_MODELS override", () => {
    process.env.GROQ_API_KEY = "key";
    process.env.LLM_MODELS = "groq:llama-3.3-70b-versatile,groq:qwen/qwen3-32b";
    resetLlmCache();

    expect(modelChain()).toEqual([
      { provider: "groq", model: "llama-3.3-70b-versatile" },
      { provider: "groq", model: "qwen/qwen3-32b" },
    ]);
  });

  it("keeps a model id containing a colon intact", () => {
    process.env.OPENROUTER_API_KEY = "key";
    process.env.LLM_MODELS = "openrouter:qwen/qwen3-235b-a22b:free";
    resetLlmCache();

    expect(modelChain()).toEqual([
      { provider: "openrouter", model: "qwen/qwen3-235b-a22b:free" },
    ]);
  });

  it("rejects a malformed override rather than guessing", () => {
    process.env.LLM_MODELS = "just-a-model-name";
    resetLlmCache();
    expect(() => modelChain()).toThrow(/provider:model/);
  });
});

describe("complete", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "key";
    process.env.LLM_MODELS = "groq:model-a,groq:model-b";
    resetLlmCache();
  });

  it("returns the first successful model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse("hello"));

    const result = await complete({ messages: [{ role: "user", content: "hi" }] });

    expect(result).toMatchObject({ text: "hello", model: "model-a", provider: "groq" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls through to the next model on a rate limit", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse("second model answered"));

    const result = await complete({ messages: [{ role: "user", content: "hi" }] });

    expect(result.model).toBe("model-b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls through when a 200 response carries an error body", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(jsonResponse("recovered"));

    const result = await complete({ messages: [{ role: "user", content: "hi" }] });
    expect(result.text).toBe("recovered");
  });

  it("reports every attempt when the whole chain fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));

    await expect(complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      LlmUnavailableError,
    );
  });

  it("explains itself when nothing is configured", async () => {
    process.env.GROQ_API_KEY = "";
    process.env.LLM_MODELS = "groq:model-a";
    resetLlmCache();

    await expect(complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /No LLM provider configured/,
    );
  });

  it("asks for JSON mode only when requested", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse("{}"));

    await complete({ messages: [{ role: "user", content: "hi" }], json: true });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits JSON mode for providers that don't support it", async () => {
    process.env.LLM_MODELS = "ollama:qwen3:8b";
    resetLlmCache();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse("{}"));

    await complete({ messages: [{ role: "user", content: "hi" }], json: true });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.response_format).toBeUndefined();
    expect(body.model).toBe("qwen3:8b");
  });
});
