"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const ROLE_SUGGESTIONS = [
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Engineering Manager",
  "ML Engineer",
];

const PROGRESS_STAGES = [
  "Reading your resume",
  "Extracting claims",
  "Scoring how defensible each one is",
  "Writing the questions an interviewer would ask",
];

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== null;
  const ready = file !== null || pasted.trim().length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setError(null);
    setStage(0);

    // The stages aren't instrumented against the pipeline — they're paced to it.
    // Analysis is one long request, and a static spinner for 40s reads as broken.
    const ticker = setInterval(
      () => setStage((current) => (current === null ? null : Math.min(current + 1, PROGRESS_STAGES.length - 1))),
      9000,
    );

    try {
      const body = new FormData();
      if (file) body.set("resume", file);
      else body.set("text", pasted);
      if (targetRole.trim()) body.set("targetRole", targetRole.trim());

      const response = await fetch("/api/analyze", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error ?? "Analysis failed.");
      router.push(`/r/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
      setStage(null);
    } finally {
      clearInterval(ticker);
    }
  }

  if (busy) {
    return (
      <div className="rise py-16">
        <div className="font-mono text-xs tracking-widest text-paper-faint">ANALYZING</div>
        <ol className="mt-8 space-y-4">
          {PROGRESS_STAGES.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 text-[15px] transition-colors ${
                index <= (stage ?? 0) ? "text-paper" : "text-paper-faint"
              }`}
            >
              <span className="font-mono text-xs">
                {index < (stage ?? 0) ? "✓" : index === stage ? "›" : "·"}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-paper-faint">
          This takes 30–60 seconds. We run open models on free capacity, so it&apos;s slower than
          it could be and free while you decide whether it&apos;s useful.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="py-10">
      {!showPaste ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer border border-dashed px-6 py-14 text-center transition-colors ${
            dragging ? "border-paper bg-ink-raised" : "border-ink-line hover:border-paper-faint"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <div className="font-mono text-sm text-paper">{file.name}</div>
              <div className="mt-2 text-xs text-paper-faint">
                {(file.size / 1024).toFixed(0)} KB · click to choose a different file
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[15px] text-paper">Drop your resume here, or click to browse</div>
              <div className="mt-2 font-mono text-xs text-paper-faint">PDF · DOCX · TXT</div>
            </div>
          )}
        </div>
      ) : (
        <textarea
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          rows={14}
          placeholder="Paste your resume text here…"
          className="w-full resize-y border border-ink-line bg-ink-raised p-4 font-mono text-sm leading-relaxed text-paper outline-none focus:border-paper-faint"
        />
      )}

      <button
        type="button"
        onClick={() => setShowPaste((current) => !current)}
        className="mt-3 font-mono text-xs text-paper-faint underline underline-offset-4 hover:text-paper-dim"
      >
        {showPaste ? "upload a file instead" : "or paste the text instead"}
      </button>

      <div className="mt-10">
        <label htmlFor="role" className="font-mono text-xs tracking-widest text-paper-faint">
          TARGET ROLE — OPTIONAL
        </label>
        <input
          id="role"
          value={targetRole}
          onChange={(event) => setTargetRole(event.target.value)}
          placeholder="Staff Software Engineer"
          className="mt-3 w-full max-w-md border-b border-ink-line bg-transparent pb-2 text-[15px] outline-none placeholder:text-paper-faint focus:border-paper-faint"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {ROLE_SUGGESTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setTargetRole(role)}
              className="border border-ink-line px-3 py-1 font-mono text-xs text-paper-dim transition-colors hover:border-paper-faint hover:text-paper"
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-8 border-l-2 border-risk-veryhigh pl-4 text-sm leading-relaxed text-paper-dim">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!ready}
        className="mt-10 bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Analyze my resume
      </button>
    </form>
  );
}
