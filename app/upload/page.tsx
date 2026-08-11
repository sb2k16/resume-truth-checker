import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload your resume — Resume Truth Checker" };

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-light tracking-tight">Upload your resume</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-paper-dim">
        We read the text, pull out every claim you&apos;ve made, and score how hard each one would
        be to defend. No account needed.
      </p>
      <UploadForm />
    </main>
  );
}
