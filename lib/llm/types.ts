export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  /** Ask the provider for strict JSON output where supported. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: string;
}

/** A concrete place we can send a chat completion: one provider, one model. */
export interface LlmTarget {
  provider: string;
  model: string;
}

export interface LlmProvider {
  name: string;
  /** False when the provider has no credentials configured; it is then skipped. */
  isConfigured(): boolean;
  complete(model: string, options: CompletionOptions): Promise<string>;
}

/**
 * Signals a request failed in a way where trying the next model in the chain is
 * the right move: rate limits, quota exhaustion, provider outages, timeouts.
 */
export class RetryableLlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RetryableLlmError";
  }
}

/** Every target in the chain failed. */
export class LlmUnavailableError extends Error {
  constructor(readonly attempts: { target: LlmTarget; error: string }[]) {
    super(
      `All ${attempts.length} model(s) failed: ` +
        attempts.map((a) => `${a.target.provider}/${a.target.model} (${a.error})`).join("; "),
    );
    this.name = "LlmUnavailableError";
  }
}

export function isRetryableStatus(status: number): boolean {
  // 429 rate limit / quota, 402 credits exhausted, 5xx provider trouble.
  return status === 429 || status === 402 || status === 408 || status >= 500;
}
