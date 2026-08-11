/**
 * End-to-end pipeline check against a real model, without the HTTP layer.
 *
 *   LLM_MODELS=ollama:qwen2.5-coder:latest npx tsx scripts/smoke.mts
 *
 * Prints what the report screen would show, so a model or prompt change can be
 * judged on its actual output rather than on whether the types still compile.
 */
import { extractClaims } from "../lib/claims/extract";
import { defensibilityScore, riskiest } from "../lib/claims/risk";
import { generateQuestionsForClaims } from "../lib/interview/questions";
import { evaluateAnswer } from "../lib/interview/evaluate";
import { summarize } from "../lib/interview/score";

const RESUME = `Souvik Example — Senior Software Engineer

AWS — Software Development Engineer, 2021-2025
Designed a distributed ingestion platform processing 10M events/day with 99.99% reliability.
Reduced operational incidents by 70%.
Implemented Java services for the OpenSearch control plane.
Led migration of four teams to a new deployment pipeline.
Architected the company's distributed data platform.
Reduced API latency by 47%.
Mentored three junior engineers.

Skills: Java, Kafka, OpenSearch, AWS, Terraform`;

const ANSWER =
  "We had a caching problem so I added a Redis layer in front of the database and latency got a lot better. The team measured it afterwards. I don't remember the exact baseline.";

async function main() {
  console.log("chain:", process.env.LLM_MODELS ?? "(default)");

  console.time("extract");
  const { claims, model } = await extractClaims(RESUME, "Staff Software Engineer");
  console.timeEnd("extract");

  console.log(`\nmodel: ${model}`);
  console.log(`claims: ${claims.length}`);
  console.log(`defensibility: ${defensibilityScore(claims)}/100\n`);

  const top = riskiest(claims, 5);
  for (const [index, claim] of top.entries()) {
    console.log(`${index + 1}. [${claim.riskLevel} ${claim.riskScore}] ${claim.claim}`);
    console.log(`   line: ${claim.sourceLine}`);
    if (claim.riskReasons.length) console.log(`   why:  ${claim.riskReasons.join(" · ")}`);
  }

  console.time("questions");
  const questions = await generateQuestionsForClaims(top.slice(0, 2), {
    targetRole: "Staff Software Engineer",
  });
  console.timeEnd("questions");

  for (const [claimId, list] of questions) {
    const claim = top.find((entry) => entry.id === claimId);
    console.log(`\nquestions for "${claim?.claim}":`);
    list.forEach((question, index) => console.log(`   ${index + 1}. ${question}`));
  }

  const target = top[0];
  const question = questions.get(target.id)?.[0] ?? "Walk me through how you achieved that.";

  console.time("evaluate");
  const evaluation = await evaluateAnswer(target, question, ANSWER, "realistic");
  console.timeEnd("evaluate");

  console.log(`\nQ: ${question}`);
  console.log(`A: ${ANSWER}`);
  console.log("scores:", evaluation.scores);
  console.log("feedback:", evaluation.feedback);
  console.log("integrity flag:", evaluation.resumeIntegrityFlag ?? "(none)");

  const summary = summarize([evaluation]);
  console.log(`\noverall: ${summary.overall}/100`);
  console.log(`weakest: ${summary.weakest?.dimension}`);
  console.log(`strongest: ${summary.strongest?.dimension}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
