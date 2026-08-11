import Link from "next/link";
import { riskiest } from "@/lib/claims/risk";
import { ScoredClaim } from "@/lib/claims/schema";
import { loadAnalysis } from "@/lib/load-analysis";
import { RiskBadge, RiskBar, ScoreDial } from "@/components/risk";

export const metadata = { title: "Your truth report — Resume Truth Checker" };

const HEADLINE_COUNT = 5;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await loadAnalysis(id);

  const headline = riskiest(analysis.claims, HEADLINE_COUNT);
  const highRisk = analysis.claims.filter(
    (claim) => claim.riskLevel === "HIGH" || claim.riskLevel === "VERY_HIGH",
  );
  const needEvidence = analysis.claims.filter((claim) => claim.evidenceRequired.length > 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="font-mono text-xs tracking-widest text-paper-faint">
        {analysis.filename.toUpperCase()}
        {analysis.targetRole ? ` · ${analysis.targetRole.toUpperCase()}` : ""}
      </div>

      <div className="mt-10 grid gap-12 border-b border-ink-line pb-14 sm:grid-cols-[1fr_auto]">
        <ScoreDial
          score={analysis.defensibility}
          caption="RESUME DEFENSIBILITY"
          hint="This is not a measure of how good your resume is. It's how prepared you are to defend what you've written."
        />

        <dl className="grid grid-cols-3 gap-8 self-end sm:grid-cols-1 sm:gap-6">
          <Stat value={analysis.claims.length} label="claims found" />
          <Stat value={highRisk.length} label="high-risk claims" tone="text-risk-high" />
          <Stat value={needEvidence.length} label="need evidence" />
        </dl>
      </div>

      <section className="py-14">
        <h1 className="text-2xl font-light tracking-tight">
          Your {headline.length} riskiest claims
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper-dim">
          Ranked by how hard they&apos;d be to defend under questioning — not by how impressive
          they sound.
        </p>

        <ol className="mt-10 space-y-px">
          {headline.map((claim, index) => (
            <ClaimRow key={claim.id} analysisId={analysis.id} claim={claim} index={index + 1} />
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            href={`/r/${analysis.id}/interview`}
            className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85"
          >
            Start the interview
          </Link>
          <span className="text-sm text-paper-faint">5 questions · about 10 minutes</span>
        </div>
      </section>

      <section className="border-t border-ink-line py-14">
        <h2 className="text-lg font-normal">Every claim we found</h2>
        <ul className="mt-8 space-y-5">
          {[...analysis.claims]
            .sort((a, b) => b.riskScore - a.riskScore)
            .map((claim) => (
              <li key={claim.id} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <Link
                  href={`/r/${analysis.id}/claims/${claim.id}`}
                  className="claim-quote block transition-colors hover:border-l-paper-faint"
                >
                  {claim.sourceLine}
                </Link>
                <div className="sm:pt-1">
                  <RiskBar level={claim.riskLevel} score={claim.riskScore} />
                </div>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div>
      <dt className={`text-3xl font-light tabular-nums ${tone ?? ""}`}>{value}</dt>
      <dd className="mt-1 font-mono text-[11px] tracking-widest text-paper-faint">
        {label.toUpperCase()}
      </dd>
    </div>
  );
}

function ClaimRow({
  analysisId,
  claim,
  index,
}: {
  analysisId: string;
  claim: ScoredClaim;
  index: number;
}) {
  return (
    <li>
      <Link
        href={`/r/${analysisId}/claims/${claim.id}`}
        className="group grid gap-4 border-b border-ink-line py-6 transition-colors hover:bg-ink-raised sm:grid-cols-[auto_1fr_auto] sm:items-start"
      >
        <span className="font-mono text-xs text-paper-faint">{String(index).padStart(2, "0")}</span>

        <div>
          <p className="text-[17px] leading-snug">{claim.claim}</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-paper-faint">
            {claim.sourceLine}
          </p>
          {claim.riskReasons.length > 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">
              {claim.riskReasons.slice(0, 2).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <RiskBadge level={claim.riskLevel} />
          <span className="font-mono text-xs text-paper-faint opacity-0 transition-opacity group-hover:opacity-100">
            open →
          </span>
        </div>
      </Link>
    </li>
  );
}
