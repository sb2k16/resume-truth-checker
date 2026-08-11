import { RiskLevel } from "@/lib/claims/schema";

const LEVEL_STYLE: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  LOW: { label: "LOW RISK", color: "text-risk-low", bg: "bg-risk-low" },
  MEDIUM: { label: "MEDIUM RISK", color: "text-risk-medium", bg: "bg-risk-medium" },
  HIGH: { label: "HIGH RISK", color: "text-risk-high", bg: "bg-risk-high" },
  VERY_HIGH: { label: "VERY HIGH RISK", color: "text-risk-veryhigh", bg: "bg-risk-veryhigh" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const style = LEVEL_STYLE[level];
  return (
    <span className={`font-mono text-[11px] tracking-widest ${style.color}`}>{style.label}</span>
  );
}

/** The §19 heatmap bar: length and colour both carry the risk. */
export function RiskBar({ level, score }: { level: RiskLevel; score: number }) {
  const style = LEVEL_STYLE[level];
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-line">
        <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-[11px] text-paper-faint">{score}</span>
    </div>
  );
}

export function riskColorVar(level: RiskLevel): string {
  return {
    LOW: "var(--risk-low)",
    MEDIUM: "var(--risk-medium)",
    HIGH: "var(--risk-high)",
    VERY_HIGH: "var(--risk-veryhigh)",
  }[level];
}

/** Big number with a track underneath — used for defensibility on §12 and §18. */
export function ScoreDial({
  score,
  caption,
  hint,
}: {
  score: number;
  caption: string;
  hint?: string;
}) {
  const tone =
    score >= 80 ? "text-risk-low" : score >= 60 ? "text-risk-medium" : "text-risk-high";
  return (
    <div>
      <div className="font-mono text-xs tracking-widest text-paper-faint">{caption}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-6xl font-light tabular-nums ${tone}`}>{score}</span>
        <span className="text-lg text-paper-faint">/ 100</span>
      </div>
      <div className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink-line">
        <div
          className={`h-full rounded-full ${
            score >= 80 ? "bg-risk-low" : score >= 60 ? "bg-risk-medium" : "bg-risk-high"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      {hint ? <p className="mt-3 max-w-sm text-sm text-paper-dim">{hint}</p> : null}
    </div>
  );
}
