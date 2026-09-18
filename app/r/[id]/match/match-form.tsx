"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PROGRESS_STAGES = [
  "Reading the posting",
  "Pulling out what it hires against",
  "Matching it to claims you can defend",
];

export function MatchForm({ analysisId, dense }: { analysisId: string; dense?: boolean }) {
  const router = useRouter();
  const [jdText, setJdText] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || jdText.trim().length < 120) return;

    setError(null);
    setStage(0);
    const ticker = setInterval(
      () =>
        setStage((current) =>
          current === null ? null : Math.min(current + 1, PROGRESS_STAGES.length - 1),
        ),
      3000,
    );

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId, jdText, role: role.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Couldn't read that posting.");

      // The match lives on the analysis, so the server component re-renders it.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't read that posting.");
    } finally {
      clearInterval(ticker);
      setStage(null);
    }
  }

  return (
    <form onSubmit={submit} className={dense ? "mt-6" : "mt-10"}>
      <textarea
        value={jdText}
        onChange={(event) => setJdText(event.target.value)}
        disabled={busy}
        rows={dense ? 6 : 12}
        placeholder="Paste the job posting here — the whole thing, requirements and all."
        className="w-full resize-y border border-ink-line bg-ink-raised px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-paper-faint focus:border-paper-faint disabled:opacity-60"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={busy}
          placeholder="Role title (optional)"
          className="border border-ink-line bg-ink-raised px-3 py-2 font-mono text-sm outline-none placeholder:text-paper-faint focus:border-paper-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || jdText.trim().length < 120}
          className="bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? PROGRESS_STAGES[stage ?? 0] : "Match this posting"}
        </button>
        {error ? <span className="text-sm text-risk-high">{error}</span> : null}
      </div>
    </form>
  );
}
