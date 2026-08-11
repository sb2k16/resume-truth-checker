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

  for (const target of other) {
    console.log(`skip   ${target.provider}:${target.model}  (not in this catalog)`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
