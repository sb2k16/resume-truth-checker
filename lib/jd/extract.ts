import { complete, parseJson, systemMessage, userMessage } from "@/lib/llm";
import { JdRequirement, jdExtractionSchema } from "./schema";
import { normalizeSkill } from "./skills";

/** Postings are padded with benefits and boilerplate; the requirements are near the top. */
const MAX_JD_CHARS = 9_000;

const SYSTEM_PROMPT = `You read a job posting and list what it actually hires against.

Rules:
- Extract capabilities, not sentences. "Experience designing distributed systems at scale" is the skill "distributed systems".
- Split a line that names several things. "Python, Go or Java" is three requirements.
- "required" means the posting states it as a must, a minimum, or lists it under requirements/qualifications. "preferred" means nice-to-have, bonus, plus.
- Skip everything that is not a capability: salary, benefits, location, visa policy, equal-opportunity boilerplate, company description, years-of-experience counts on their own.
- Skip education entirely. "BS in Computer Science", "MS or PhD in databases" and the like are not skills — a candidate cannot prepare for an interview question about a degree, and listing them as gaps buries the requirements that matter.
- Skip dispositions and ways of working: "comfortable with ambiguity", "driven by customer value", "comfortable working towards a multi-year vision". They are real, but nothing on a resume evidences them and every one of them reports as a gap.
- Skip duplicates. One entry per capability.
- "sourceLine" is the posting's own wording, copied.

Respond with JSON only:
{"requirements":[{"skill":"Kubernetes","importance":"required","sourceLine":"..."}]}`;

export interface JdExtractionResult {
  requirements: JdRequirement[];
  model: string;
}

export async function extractRequirements(jdText: string): Promise<JdExtractionResult> {
  const { text, model } = await complete({
    messages: [
      systemMessage(SYSTEM_PROMPT),
      userMessage(`JOB POSTING:\n\n${jdText.slice(0, MAX_JD_CHARS)}\n\nList what this role hires against.`),
    ],
    json: true,
    temperature: 0.1,
    maxTokens: 2000,
  });

  const parsed = parseJson(text, jdExtractionSchema);
  return { requirements: dedupe(parsed.requirements.filter(isCapability)), model };
}

/**
 * Degrees survive the prompt often enough to need a second line of defence:
 * one posting produced "Computer Science degree", "MS in databases", "PhD in
 * databases", "MS in distributed systems" and "PhD in distributed systems" as
 * five separate unmet requirements, which is most of a coverage score spent on
 * something no interview prep can change.
 */

/**
 * A credential, not a mention of one. The degree abbreviations only count when
 * the requirement is the degree itself — "MS in databases" — so "MS SQL Server"
 * survives, and so does "graduate-level algorithms research".
 */
const CREDENTIAL = /^\s*(bs|ba|bsc|ms|msc|ma|mba|ph\.?d|b\.s\.|m\.s\.|bachelor'?s?|master'?s?|doctorate)\b(\s+in\b|\s*$)/i;
const AWARDED = /\b(degree|diploma)\b/i;

export function isCapability(requirement: JdRequirement): boolean {
  return !CREDENTIAL.test(requirement.skill) && !AWARDED.test(requirement.skill);
}

/**
 * Postings repeat themselves — the same skill appears under "requirements" and
 * again under "what you'll do". Keep the stronger importance when they differ,
 * so a skill listed as required anywhere is treated as required.
 */
function dedupe(requirements: JdRequirement[]): JdRequirement[] {
  const bySkill = new Map<string, JdRequirement>();

  for (const requirement of requirements) {
    const key = normalizeSkill(requirement.skill);
    const existing = bySkill.get(key);
    if (!existing) {
      bySkill.set(key, requirement);
      continue;
    }
    if (existing.importance === "preferred" && requirement.importance === "required") {
      bySkill.set(key, requirement);
    }
  }

  return [...bySkill.values()];
}
