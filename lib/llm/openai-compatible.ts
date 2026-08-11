import {
  CompletionOptions,
  LlmProvider,
  RetryableLlmError,
  isRetryableStatus,
} from "./types";

interface OpenAiCompatibleConfig {
  name: string;
  baseUrl: string;
  /** Absent means no auth header is sent (local Ollama). */
  apiKey?: string;
  /** Sent by OpenRouter for attribution; harmless elsewhere. */
  extraHeaders?: Record<string, string>;
  /** Ollama ignores response_format; skip it there rather than confusing the model. */
  supportsJsonMode?: boolean;
}

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Hosted free tiers answer well inside the default. A self-hosted or local
 * model doing a long structured extraction can take several minutes, so the
 * ceiling is configurable rather than assuming the hosted case.
 */
function timeoutMs(): number {
  const configured = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * OpenRouter, Groq and Ollama all expose the same /chat/completions shape, so
 * one client covers every provider we care about. Swapping in a self-hosted
 * vLLM box on Fly later is a matter of adding a config here — vLLM serves the
 * same API.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.name;
  }

  isConfigured(): boolean {
    // A provider with no key configured is skipped rather than failed, so a
    // developer with only one key set still gets a working chain.
    return this.config.apiKey !== undefined ? this.config.apiKey.length > 0 : true;
  }

  async complete(model: string, options: CompletionOptions): Promise<string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.config.extraHeaders,
    };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.json && this.config.supportsJsonMode !== false) {
      body.response_format = { type: "json_object" };
    }

    const timeout = AbortSignal.timeout(timeoutMs());
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      // Network failure or timeout — worth trying the next model.
      throw new RetryableLlmError(
        error instanceof Error ? error.message : "network error",
      );
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      const message = `${response.status} ${detail || response.statusText}`;
      if (isRetryableStatus(response.status)) {
        throw new RetryableLlmError(message, response.status);
      }
      throw new Error(`${this.name} rejected the request: ${message}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    // Free-tier endpoints sometimes return 200 with an error body.
    if (payload.error) throw new RetryableLlmError(payload.error.message ?? "provider error");

    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new RetryableLlmError("empty completion");
    return text;
  }
}
