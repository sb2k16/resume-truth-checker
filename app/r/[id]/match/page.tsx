import Link from "next/link";
import { Coverage, JobMatch, RequirementMatch } from "@/lib/jd/schema";
import { loadAnalysis } from "@/lib/load-analysis";
import { ScoreDial } from "@/components/risk";
import { MatchForm } from "./match-form";

export const metadata = { title: "Match a posting — Resume Truth Checker" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await loadAnalysis(id);
  const match = analysis.jobMatch;

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <Link
        href={`/r/${analysis.id}`}
        className="font-mono text-xs text-paper-faint hover:text-paper-dim"
      >
        ← back to report
      </Link>

      {match === null ? (
        <>
          <h1 className="mt-10 text-2xl font-light tracking-tight">Point this at a posting</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper-dim">
            We&apos;ll show what the role hires against, which of it you can defend today, and
            what the interview will open with. Nothing is matched on keywords — a requirement
            only counts as covered if a claim on your resume backs it.
          </p>
          <MatchForm analysisId={analysis.id} />
        </>
      ) : (
        <Results analysisId={analysis.id} match={match} />
      )}
    </main>
  );
}

function Results({ analysisId, match }: { analysisId: string; match: JobMatch }) {
  const required = match.requirements.filter((entry) => entry.requirement.importance === "required");
  const preferred = match.requirements.filter(
    (entry) => entry.requirement.importance === "preferred",
  );
  const weak = match.requirements.filter((entry) => entry.coverage === "weak");

  return (
    <>
      <div className="mt-10 font-mono text-xs tracking-widest text-paper-faint">
        {match.role.toUpperCase()}
      </div>

      <div className="mt-8 grid gap-12 border-b border-ink-line pb-14 sm:grid-cols-[1fr_auto]">
        <ScoreDial
          score={match.coverageScore}
          caption="DEFENSIBLE COVERAGE"
          hint="Not how well you match on paper — how much of what this role asks for you could hold up under questioning today."
        />
        <dl className="grid grid-cols-3 gap-8 self-end sm:grid-cols-1 sm:gap-6">
          <Stat value={match.requirements.length} label="requirements found" />
          <Stat value={weak.length} label="covered but undefended" tone="text-risk-high" />
          <Stat
            value={match.requirements.filter((entry) => entry.coverage === "listed").length}
            label="listed, nothing behind it"
            tone="text-risk-veryhigh"
          />
        </dl>
      </div>

      {match.resumeSkills.length > 0 ? (
        <section className="py-14">
          <h2 className="font-mono text-xs tracking-widest text-paper-faint">YOUR RESUME</h2>
          <ul className="mt-6 space-y-3">
            {match.resumeSkills.map((skill) => (
              <li key={skill.skill} className="grid grid-cols-[1fr_auto] items-center gap-4">
                <div className="flex items-center gap-4">
                  <span className="w-44 shrink-0 truncate text-[15px]">{skill.skill}</span>
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink-line">
                    <div
                      className="h-full rounded-full bg-risk-low"
                      style={{ width: `${skill.defensibility}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-[11px] text-paper-faint">
                  {skill.claimCount} claim{skill.claimCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-paper-faint">
            Bar length is how defensible the claims behind each skill are — not how often you
            mentioned it.
          </p>
        </section>
      ) : null}

      <section className="border-t border-ink-line py-14">
        <h2 className="font-mono text-xs tracking-widest text-paper-faint">THIS ROLE REQUIRES</h2>
        <ul className="mt-6 space-y-px">
          {required.map((entry) => (
            <RequirementRow key={entry.requirement.skill} entry={entry} analysisId={analysisId} />
          ))}
        </ul>

        {preferred.length > 0 ? (
          <>
            <h2 className="mt-12 font-mono text-xs tracking-widest text-paper-faint">
              NICE TO HAVE
            </h2>
            <ul className="mt-6 space-y-px">
              {preferred.map((entry) => (
                <RequirementRow
                  key={entry.requirement.skill}
                  entry={entry}
                  analysisId={analysisId}
                />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {match.focus.length > 0 ? (
        <section className="border-t border-ink-line py-14">
          <h2 className="font-mono text-xs tracking-widest text-risk-high">
            LIKELY INTERVIEW FOCUS
          </h2>
          <ol className="mt-6 space-y-4">
            {match.focus.map((skill, index) => (
              <li key={skill} className="flex gap-4 text-[17px] leading-relaxed">
                <span className="pt-1 font-mono text-xs text-paper-faint">{index + 1}</span>
                <span>{skill}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-paper-dim">
            Ranked by where you&apos;re exposed, not by what the posting lists first. A
            requirement you cover with a claim you can&apos;t defend outranks one you don&apos;t
            cover at all — the gap you can admit in a sentence; the claim takes three follow-ups
            to collapse.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={`/r/${analysisId}/interview`}
              className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85"
            >
              Interview me on these
            </Link>
            <span className="text-sm text-paper-faint">
              5 questions, aimed at what this role will press
            </span>
          </div>
        </section>
      ) : null}

      <section className="border-t border-ink-line py-14">
        <h2 className="font-mono text-xs tracking-widest text-paper-faint">
          MATCH A DIFFERENT POSTING
        </h2>
        <MatchForm analysisId={analysisId} dense />
      </section>
    </>
  );
}

const COVERAGE_STYLE: Record<Coverage, { mark: string; color: string; label: string }> = {
  strong: { mark: "✓", color: "text-risk-low", label: "you can defend this" },
  weak: { mark: "⚠", color: "text-risk-high", label: "covered, but not defensibly" },
  listed: {
    mark: "!",
    color: "text-risk-veryhigh",
    label: "listed on your resume, but no claim backs it",
  },
  missing: { mark: "○", color: "text-paper-faint", label: "not on your resume" },
};

function RequirementRow({
  entry,
  analysisId,
}: {
  entry: RequirementMatch;
  analysisId: string;
}) {
  const style = COVERAGE_STYLE[entry.coverage];
  const firstClaim = entry.claimIds[0];

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-ink-line py-4">
      <span className={`font-mono text-sm ${style.color}`}>{style.mark}</span>
      <div>
        <div className="text-[15px]">{entry.requirement.skill}</div>
        <div className="mt-1 text-xs text-paper-faint">{style.label}</div>
      </div>
      {firstClaim ? (
        <Link
          href={`/r/${analysisId}/claims/${firstClaim}`}
          className="font-mono text-[11px] text-paper-faint hover:text-paper-dim"
        >
          {entry.defensibility}/100 →
        </Link>
      ) : (
        <span className="font-mono text-[11px] text-paper-faint">—</span>
      )}
    </li>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div>
      <dt className={`text-3xl font-light tabular-nums ${tone ?? ""}`}>{value}</dt>
      <dd className="mt-1 font-mono text-[11px] tracking-wide text-paper-faint">{label}</dd>
    </div>
  );
}
