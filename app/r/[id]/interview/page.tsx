import Link from "next/link";
import { loadAnalysis } from "@/lib/load-analysis";
import { InterviewClient } from "./interview-client";

export const metadata = { title: "Interview — Resume Truth Checker" };

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const [{ id }, { claim }] = await Promise.all([params, searchParams]);
  const analysis = await loadAnalysis(id);
  const focus = claim && analysis.claims.some((entry) => entry.id === claim) ? claim : undefined;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link
        href={`/r/${analysis.id}`}
        className="font-mono text-xs text-paper-faint hover:text-paper-dim"
      >
        ← back to report
      </Link>
      <h1 className="mt-8 text-3xl font-light tracking-tight">
        {focus ? "Defend this claim" : "Defend your resume"}
      </h1>
      <InterviewClient analysisId={analysis.id} focusClaimId={focus} />
    </main>
  );
}
