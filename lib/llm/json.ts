import { z } from "zod";

/**
 * Free open-weight models are noticeably worse than frontier models at emitting
 * bare JSON: they wrap it in prose, fence it as markdown, or bolt on a
 * "Here's the analysis:" preamble even under a json_object response_format.
 * Rather than fail the request, recover the JSON payload ourselves.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();

  const direct = tryParse(text);
  if (direct.ok) return direct.value;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed.ok) return parsed.value;
  }

  const balanced = firstBalancedValue(text);
  if (balanced) {
    const parsed = tryParse(balanced);
    if (parsed.ok) return parsed.value;
  }

  throw new Error(`Model did not return JSON. First 200 chars: ${text.slice(0, 200)}`);
}

export function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  return schema.parse(extractJson(raw));
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Scan for the first balanced {...} or [...] run, respecting string literals so
 * a brace inside a resume bullet doesn't truncate the object.
 */
function firstBalancedValue(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
