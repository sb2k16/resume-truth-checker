/**
 * Check the OpenRouter entries in the default chain against the live catalog.
 *
 *   npm run check:models
 *
 * Free model ids are retired without notice — every id in the first version of
 * DEFAULT_CHAIN was dead within days of being written. This turns "why is
 * everything failing" into a five-second answer, and prints replacement
 * candidates when something has gone.
 *
 * Needs no API key. Groq and Ollama entries can't be checked this way and are
 * reported as skipped.
 */
import { DEFAULT_CHAIN } from "../lib/llm";

interface CatalogModel {
  id: string;
  context_length: number;
  supported_parameters?: string[];
}

const CATALOG_URL = "https://openrouter.ai/api/v1/models";

async function main() {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    throw new Error(`OpenRouter catalog returned ${response.status}`);
  }

  const { data } = (await response.json()) as { data: CatalogModel[] };
  const byId = new Map(data.map((model) => [model.id, model]));

  const openrouter = DEFAULT_CHAIN.filter((target) => target.provider === "openrouter");
  const other = DEFAULT_CHAIN.filter((target) => target.provider !== "openrouter");

  let missing = 0;

  console.log(`catalog: ${data.length} models\n`);
  for (const target of openrouter) {
    const model = byId.get(target.model);
    if (!model) {
      missing++;
      console.log(`GONE   ${target.model}`);
      continue;
    }
    const json = model.supported_parameters?.includes("response_format") ? "json" : "NO JSON MODE";
    console.log(`ok     ${target.model}  (ctx ${model.context_length}, ${json})`);
  }

  await checkGroq();

  for (const target of other.filter((t) => t.provider !== "groq")) {
    console.log(`skip   ${target.provider}:${target.model}  (not checkable)`);
  }

  if (missing > 0) {
    // Only suggest models that can be asked for strict JSON — the extraction
    // and evaluation prompts both depend on it.
    const candidates = data
      .filter(
        (model) =>
          model.id.endsWith(":free") && model.supported_parameters?.includes("response_format"),
      )
      .sort((a, b) => b.context_length - a.context_length);

    console.log(`\n${missing} model(s) retired. Free replacements that support JSON mode:\n`);
    for (const model of candidates) {
      console.log(`   ${model.id}  (ctx ${model.context_length})`);
    }
    console.log(
      "\nPick open-weight ones only, and spread them across vendors — free quotas are\n" +
        "metered per upstream provider, so same-vendor fallbacks fail together.",
    );
    process.exitCode = 1;
  }
}

/**
 * Groq's list needs the key, so this is best-effort — but Groq retires models
 * exactly as readily as OpenRouter does, and one of the two originally in the
 * chain was already gone.
 */
async function checkGroq(): Promise<void> {
  const targets = DEFAULT_CHAIN.filter((target) => target.provider === "groq");
  if (targets.length === 0) return;

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    for (const target of targets) {
      console.log(`skip   groq:${target.model}  (set GROQ_API_KEY to check)`);
    }
    return;
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    console.log(`skip   groq  (/models returned ${response.status})`);
    return;
  }

  const { data } = (await response.json()) as { data: { id: string }[] };
  const live = new Set(data.map((model) => model.id));
  for (const target of targets) {
    console.log(live.has(target.model) ? `ok     groq:${target.model}` : `GONE   groq:${target.model}`);
    if (!live.has(target.model)) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
