import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Truth Checker — can you defend every line?",
  description:
    "Upload your resume. We find the claims an interviewer is most likely to challenge, then interview you on them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-ink-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-mono text-sm tracking-tight text-paper">
              resume<span className="text-risk-high">.</span>truth
            </Link>
            <span className="font-mono text-xs text-paper-faint">
              your interviewer will question your resume
            </span>
          </div>
        </header>
        {children}
        <footer className="mt-24 border-t border-ink-line">
          <div className="mx-auto max-w-5xl px-6 py-8 text-xs leading-relaxed text-paper-faint">
            We never invent experience or numbers on your behalf. Your resume text is kept only
            for this session and the file you upload is discarded after we read it.
          </div>
        </footer>
      </body>
    </html>
  );
}
