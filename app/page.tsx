import Link from "next/link";

const EXAMPLE_QUESTIONS = [
  "What was the baseline?",
  "How did you measure the 40%?",
  "Was this p50, p95, or p99?",
  "What did you personally change?",
  "What was the primary bottleneck?",
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      <section className="py-20 sm:py-28">
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-light tracking-tight sm:text-6xl">
          Can you defend every line on your resume?
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-dim">
          Upload your resume. We&apos;ll find the claims an interviewer is most likely to
          challenge.
        </p>

        <Link
          href="/upload"
          className="mt-10 inline-block bg-paper px-6 py-3 font-mono text-sm text-ink transition-opacity hover:opacity-85"
        >
          Analyze my resume
        </Link>

        <p className="mt-6 max-w-lg text-sm leading-relaxed text-paper-faint">
          No resume rewriting. No generic career advice. Just an honest assessment of whether you
          can defend your experience.
        </p>
      </section>

      <section className="border-t border-ink-line py-16">
        <div className="grid gap-12 sm:grid-cols-2">
          <div>
            <div className="font-mono text-xs tracking-widest text-paper-faint">
              ONE LINE ON YOUR RESUME
            </div>
            <blockquote className="claim-quote mt-5">Reduced API latency by 40%.</blockquote>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-paper-dim">
              It reads well. It got you the interview. Now the person across the table has to
              decide whether to believe it.
            </p>
          </div>

          <div>
            <div className="font-mono text-xs tracking-widest text-risk-high">
              WHAT THEY WILL ASK
            </div>
            <ol className="mt-5 space-y-3">
              {EXAMPLE_QUESTIONS.map((question, index) => (
                <li key={question} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="font-mono text-xs text-paper-faint">{index + 1}</span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-line py-16">
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "We extract the claims",
              body: "Every bullet becomes a testable assertion, categorised and scored for how hard it is to defend.",
            },
            {
              step: "02",
              title: "We show you the risky ones",
              body: "Missing baselines, unclear ownership, numbers with no method behind them.",
            },
            {
              step: "03",
              title: "Then we interview you",
              body: "Questions drawn only from your resume. Answer them here instead of in the room.",
            },
          ].map((item) => (
            <div key={item.step}>
              <div className="font-mono text-xs text-paper-faint">{item.step}</div>
              <h2 className="mt-3 text-lg font-normal">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-dim">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
