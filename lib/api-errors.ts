import { NextResponse } from "next/server";
import { LlmUnavailableError } from "@/lib/llm";
import { UnsupportedFileError } from "@/lib/parse/extract-text";

/**
 * Turn an internal failure into something a candidate can act on. The free-tier
 * exhaustion case matters most: it is expected, not exceptional, and the user
 * needs to know it's us and not their resume.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnsupportedFileError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof LlmUnavailableError) {
    console.error("[llm] all models failed", error.attempts);
    return NextResponse.json(
      {
        error: error.rateLimited
          ? "Every free model we use is rate-limited right now. Wait a minute and try again — nothing about your resume caused this."
          : "We couldn't reach a model to read your resume. That's a problem on our side, not with your resume — please try again shortly.",
      },
      { status: 503 },
    );
  }

  console.error("[api] unhandled", error);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
