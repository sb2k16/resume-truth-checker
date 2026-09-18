import { complete, parseJson, systemMessage, userMessage } from "@/lib/llm";
import {
  EVIDENCE_LABELS,
  RewriteSuggestion,
  ScoredClaim,
  rewriteSuggestionSchema,
} from "./schema";

/**
 * §20 — the rewrite, which only exists downstream of the truth analysis. The
 * product is not an optimizer (§37): the suggestion here is never "say it
 * louder", it is "say what you can defend, and go find the rest".
 *
 * The one inviolable rule (§20, §31) is that the system must never invent a
 * number. A prompt rule is not enough for a weak free model, so
 * `inventedNumbers` re-checks the output against the resume line and a
 * violation costs a repair round rather than reaching the page.
 */

const SYSTEM_PROMPT = `You reword one resume claim so the candidate can defend every part of it.

Rules:
- NEVER introduce a number, percentage, duration, team size or scale that is not already in the resume line. This is absolute. If a number cannot be substantiated, the fix is to remove it or describe the effect qualitatively — not to replace it with a different number.
- Never invent facts about what happened. You only have the resume line; you do not know what the candidate actually did beyond it.
- Never assert HOW something was measured, monitored or verified unless the resume line says so. "according to uptime metrics", "as measured by our dashboards", "validated in load testing" are inventions even though they carry no number — they are the single most tempting thing to add here, because every gap in the claim is about measurement. The measurement method belongs in "prepare", never in the rewrite.
- Keep the candidate's voice and the resume register: one line, past tense, no first-person pronoun, no filler adjectives.
- Where the claim's weakness is ownership, make the scope honest ("contributed to", "led the X workstream of") rather than shrinking the achievement for its own sake.
- "prepare" is what the candidate must go and find out before the interview so the ORIGINAL, stronger claim becomes defensible — a baseline figure, a dashboard, a measurement period. Each entry is a concrete thing to look up, not advice.

Respond with JSON only:
{"rewrite":"...","rationale":"one sentence on what the change fixes","prepare":["...","..."]}`;

export async function suggestRewrite(
  claim: ScoredClaim,
  targetRole?: string,
): Promise<RewriteSuggestion> {
  const missing = claim.evidenceRequired.map((kind) => EVIDENCE_LABELS[kind]).join(", ");
  const context = [
    `RESUME LINE: ${claim.sourceLine}`,
    `CLAIM: ${claim.claim}`,
    `RISK: ${claim.riskLevel} (${claim.riskScore}/100)`,
    missing ? `UNSPECIFIED: ${missing}` : null,
    claim.riskReasons.length ? `WHY IT IS CHALLENGED: ${claim.riskReasons.join("; ")}` : null,
    targetRole ? `TARGET ROLE: ${targetRole}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [systemMessage(SYSTEM_PROMPT), userMessage(context)];

  const first = await complete({ messages, json: true, temperature: 0.3, maxTokens: 700 });
  const suggestion = parseJson(first.text, rewriteSuggestionSchema);

  const invented = inventedNumbers(claim, suggestion.rewrite);
  if (invented.length === 0) return suggestion;

  // One repair round, naming the offending figures. Models that fabricate a
  // number usually drop it when shown which one they made up.
  const repair = await complete({
    messages: [
      ...messages,
      { role: "assistant", content: first.text.slice(0, 2000) },
      userMessage(
        `Rejected: the rewrite introduced ${invented.join(", ")}, which does not appear in the resume line. ` +
          `Rewrite it again using only figures already present, or with no figure at all.`,
      ),
    ],
    json: true,
    temperature: 0.1,
    maxTokens: 700,
  });

  const repaired = parseJson(repair.text, rewriteSuggestionSchema);
  if (inventedNumbers(claim, repaired.rewrite).length > 0) {
    throw new InventedNumberError(invented);
  }
  return repaired;
}

/** A rewrite that fabricated a figure twice. Better no suggestion than a false one. */
export class InventedNumberError extends Error {
  constructor(readonly figures: string[]) {
    super(`Rewrite introduced figures absent from the resume: ${figures.join(", ")}`);
    this.name = "InventedNumberError";
  }
}

const WORD_NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

/**
 * Figures in the rewrite that the candidate never wrote down. Compared against
 * the claim as well as the source line, because extraction restates the line
 * and may carry a figure the verbatim text expressed in words.
 */
export function inventedNumbers(
  claim: Pick<ScoredClaim, "claim" | "sourceLine">,
  rewrite: string,
): string[] {
  // The allowed set is deliberately wider than the source's literal digits: it
  // also carries spelled-out numbers, so "mentored three engineers" may be
  // rewritten as "mentored 3 engineers".
  const known = new Set([
    ...figures(claim.sourceLine).map((match) => match.normalized),
    ...figures(claim.claim).map((match) => match.normalized),
    ...spelledNumbers(claim.sourceLine),
    ...spelledNumbers(claim.claim),
  ]);

  const seen = new Set<string>();
  const invented: string[] = [];
  for (const { raw, normalized } of figures(rewrite)) {
    if (known.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    invented.push(raw);
  }
  return invented;
}

/**
 * Digit runs that carry a quantity. A digit glued to the end of a word is part
 * of a name, not a figure — p99, S3, EC2, HTTP2 — and flagging those would
 * reject the technically specific rewrites this product most wants.
 *
 * Scale suffixes (10M, 4k) normalize to their digits: the magnitude word can't
 * be invented without the digits that carry it.
 */
function figures(text: string): { raw: string; normalized: string }[] {
  const matches: { raw: string; normalized: string }[] = [];

  for (const match of text.matchAll(/(^|[^A-Za-z\d])(\d[\d,]*(?:\.\d+)?\s*%?)/g)) {
    const raw = match[2].trim();
    matches.push({ raw, normalized: normalize(raw) });
  }

  return matches;
}

/**
 * Spelled-out numbers are read from the resume only, never from the rewrite:
 * "one" and "two" are ordinary English ("week one", "one of the services") and
 * scanning the rewrite for them flags prose as fabrication. The cost is that a
 * rewrite inventing "threefold" passes — a figure a candidate cannot be pinned
 * to a dashboard on, and far rarer than an invented digit.
 */
function spelledNumbers(text: string): string[] {
  return Object.entries(WORD_NUMBERS)
    .filter(([word]) => new RegExp(`\\b${word}\\b`, "i").test(text))
    .map(([, digit]) => digit);
}

/** "1,200" and "1200" are the same figure; so are "47%" and "47". */
function normalize(raw: string): string {
  return raw
    .replace(/[\s%,]/g, "")
    .replace(/\.0+$/, "");
}
