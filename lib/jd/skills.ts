/**
 * Skill identity, in code. A job description says "React.js" where a resume
 * says "React", and "Postgres" where the resume says "PostgreSQL" — treating
 * those as different skills would report gaps that aren't there, which is the
 * failure mode that makes every keyword matcher useless.
 *
 * Deliberately a small curated table rather than a taxonomy: the aliases below
 * are the ones that actually collide in engineering resumes. An unknown skill
 * falls through to plain normalization and still matches itself.
 */

const SKILL_ALIASES: Record<string, string> = {
  reactjs: "react",
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  golang: "go",
  postgres: "postgresql",
  psql: "postgresql",
  k8s: "kubernetes",
  tf: "terraform",
  gcp: "googlecloud",
  googlecloudplatform: "googlecloud",
  amazonwebservices: "aws",
  ml: "machinelearning",
  ai: "artificialintelligence",
  cicd: "continuousintegration",
  ci: "continuousintegration",
  iac: "infrastructureascode",
  k6: "loadtesting",
  rdbms: "sql",
  nosql: "nosql",
  distributedsystem: "distributedsystems",
  microservice: "microservices",
};

/** Surface forms to look for in prose, keyed by the canonical skill. */
const VARIANTS = new Map<string, string[]>();
for (const [variant, canonical] of Object.entries(SKILL_ALIASES)) {
  VARIANTS.set(canonical, [...(VARIANTS.get(canonical) ?? []), variant]);
}

/** Lowercased, punctuation-stripped, alias-resolved. "C++" and "C#" survive. */
export function normalizeSkill(raw: string): string {
  const compact = raw.toLowerCase().replace(/[^a-z0-9+#]/g, "");
  return SKILL_ALIASES[compact] ?? compact;
}

/**
 * Plural-tolerant equality: "distributed system" and "distributed systems" are
 * one skill. Applied as a comparison rather than by stemming, because stemming
 * turns "kubernetes" into "kubernete" and "aws" into "aw".
 *
 * The length floor is what stops that second case: without it "AWS" and "AW"
 * compare equal, since one is literally the other plus an s.
 */
const MIN_PLURAL_LENGTH = 4;

export function sameSkill(a: string, b: string): boolean {
  const left = normalizeSkill(a);
  const right = normalizeSkill(b);
  if (left === right) return true;

  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  return shorter.length >= MIN_PLURAL_LENGTH && longer === `${shorter}s`;
}

/**
 * Words that name the same thing for our purposes. A posting asks for
 * "distributed systems"; the resume says "distributed ingestion platform".
 * Requiring the posting's noun verbatim would report that as a gap — the single
 * most common way a skill matcher lies to someone.
 *
 * Deliberately a handful of head nouns rather than a synonym taxonomy. Each
 * group is a set of words that, in a resume bullet, are interchangeable.
 */
const WORD_GROUPS: string[][] = [
  ["system", "systems", "platform", "platforms", "infrastructure", "architecture", "stack", "pipeline", "pipelines", "service", "services"],
  ["leadership", "lead", "leads", "leading", "led", "mentor", "mentored", "mentoring", "manage", "managed", "managing"],
  ["scalability", "scale", "scaling", "scalable", "throughput"],
  ["reliability", "reliable", "uptime", "availability"],
  ["testing", "tests", "test", "qa"],
];

const GROUP_BY_WORD = new Map<string, string[]>();
for (const group of WORD_GROUPS) {
  for (const word of group) GROUP_BY_WORD.set(word, group);
}

/** Words that carry no meaning in a skill phrase. */
const STOPWORDS = new Set(["of", "the", "and", "with", "in", "for", "to", "a", "an", "on", "at"]);

/**
 * Adjectives postings add for emphasis. "Technical leadership" is the skill
 * "leadership": requiring the word "technical" to appear in a resume bullet
 * reports a gap for someone whose bullet reads "Led migration of four teams".
 */
const WEAK_MODIFIERS = new Set([
  "technical", "strong", "deep", "solid", "proven", "demonstrated", "hands", "modern",
  "excellent", "extensive", "significant", "advanced", "practical", "working", "production",
]);

/**
 * Whether a piece of prose talks about a skill. Used to find a requirement in
 * a claim that never listed it as a technology — "Designed a distributed
 * ingestion platform" evidences "distributed systems" without tagging it.
 *
 * A single-word skill has to appear (or one of its aliases or group-mates). A
 * phrase needs every modifier present and its head noun matched through the
 * group, which is what bridges "systems" to "platform" without letting
 * "distributed systems" match any sentence containing the word "platform".
 */
export function mentions(text: string, skill: string): boolean {
  let tokens = skill
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

  // Drop emphasis adjectives, but never the whole phrase: "strong" alone still
  // has to match something.
  const meaningful = tokens.filter((token) => !WEAK_MODIFIERS.has(token));
  if (meaningful.length > 0) tokens = meaningful;

  if (tokens.length === 0) return false;
  if (tokens.length === 1) return containsAny(text, surfacesFor(tokens[0]));

  const head = tokens[tokens.length - 1];
  const modifiers = tokens.slice(0, -1);

  return (
    modifiers.every((modifier) => containsAny(text, surfacesFor(modifier))) &&
    containsAny(text, surfacesFor(head))
  );
}

/** Every spelling of one word we would accept: itself, its aliases, its group. */
function surfacesFor(token: string): string[] {
  const canonical = normalizeSkill(token);
  return [
    token,
    canonical,
    ...(VARIANTS.get(canonical) ?? []),
    ...(GROUP_BY_WORD.get(token) ?? []),
  ];
}

function containsAny(text: string, surfaces: string[]): boolean {
  const haystack = text.toLowerCase();

  return surfaces.some((surface) => {
    const needle = surface.trim().toLowerCase();
    if (needle.length < 2) return false;

    // \b is meaningless next to "+" or "#", so those match as plain substrings.
    if (/[^a-z0-9\s]/.test(needle)) return haystack.includes(needle);

    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}e?s?\\b`, "i").test(haystack);
  });
}
