import { OpenAiCompatibleProvider } from "./openai-compatible";
import {
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  LlmProvider,
  LlmTarget,
  LlmUnavailableError,
  RetryableLlmError,
} from "./types";

export * from "./types";
export { extractJson, parseJson } from "./json";

/**
 * Every model here is open-weight and reachable on a free tier. Order matters:
 * the chain is tried top to bottom and a rate limit falls through to the next
 * entry, which is what keeps this inside the $0-20/mo budget.
 *
 * The OpenRouter entries are deliberately spread across vendors — NVIDIA,
 * Google, OpenAI's open release — because free-tier quotas are metered per
 * upstream provider. Three DeepSeek variants would share one bucket and fall
 * over together.
 *
 * Free model ids churn: OpenRouter retires them without notice, and every id in
 * the original version of this list was gone within days. Re-check with
 * `npm run check:models` before blaming a prompt for a failure.
 *
 * Override with LLM_MODELS="provider:model,provider:model".
 */
export const DEFAULT_CHAIN: LlmTarget[] = [
  // Verified against the live catalog 2026-08-10; all support response_format.
  { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "openai/gpt-oss-20b:free" },
  { provider: "openrouter", model: "nvidia/nemotron-nano-9b-v2:free" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "groq", model: "qwen/qwen3-32b" },
  { provider: "ollama", model: "qwen3:8b" },
];

let cachedProviders: Map<string, LlmProvider> | null = null;

function providers(): Map<string, LlmProvider> {
  if (cachedProviders) return cachedProviders;

  const map = new Map<string, LlmProvider>();

  map.set(
    "openrouter",
    new OpenAiCompatibleProvider({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      extraHeaders: {
        "http-referer": process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
        "x-title": "Resume Truth Checker",
      },
    }),
  );

  map.set(
    "groq",
    new OpenAiCompatibleProvider({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY ?? "",
    }),
  );

  map.set(
    "ollama",
    new OpenAiCompatibleProvider({
      name: "ollama",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
      supportsJsonMode: false,
    }),
  );

  cachedProviders = map;
  return map;
}

/** Exposed for tests, which swap in a fake chain. */
export function resetLlmCache(): void {
  cachedProviders = null;
}

export function modelChain(): LlmTarget[] {
  const override = process.env.LLM_MODELS?.trim();
  const chain = override
    ? override
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const separator = entry.indexOf(":");
          if (separator === -1) {
            throw new Error(`LLM_MODELS entry "${entry}" must be "provider:model"`);
          }
          return {
            provider: entry.slice(0, separator),
            model: entry.slice(separator + 1),
          };
        })
    : DEFAULT_CHAIN;

  const available = providers();
  return chain.filter((target) => available.get(target.provider)?.isConfigured());
}

/**
 * Run a completion against the first model in the chain that answers.
 * Non-retryable errors (a bad request, a missing model) stop the chain only for
 * that target; rate limits and outages move on to the next one.
 */
export async function complete(options: CompletionOptions): Promise<CompletionResult> {
  const chain = modelChain();
  if (chain.length === 0) {
    throw new Error(
      "No LLM provider configured. Set OPENROUTER_API_KEY or GROQ_API_KEY, or run Ollama locally.",
    );
  }

  const attempts: { target: LlmTarget; error: string }[] = [];

  for (const target of chain) {
    const provider = providers().get(target.provider);
    if (!provider) {
      attempts.push({ target, error: "unknown provider" });
      continue;
    }

    try {
      const text = await provider.complete(target.model, options);
      return { text, model: target.model, provider: target.provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ target, error: message });

      // A hard rejection from one model (unsupported params, unknown model id)
      // still lets the next model try — but log it distinctly in the attempts.
      if (!(error instanceof RetryableLlmError)) continue;
    }
  }

  throw new LlmUnavailableError(attempts);
}

export function systemMessage(content: string): ChatMessage {
  return { role: "system", content };
}

export function userMessage(content: string): ChatMessage {
  return { role: "user", content };
}
