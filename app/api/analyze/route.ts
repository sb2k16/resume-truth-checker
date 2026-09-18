import { NextRequest, NextResponse } from "next/server";
import { extractClaims } from "@/lib/claims/extract";
import { defensibilityScore, riskiest } from "@/lib/claims/risk";
import { generateQuestionsForClaims } from "@/lib/interview/questions";
import { UnsupportedFileError, extractResumeText } from "@/lib/parse/extract-text";
import { getStore } from "@/lib/store";
import { ensureSessionId, newId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const ANALYSES_PER_HOUR = 8;

export async function POST(request: NextRequest) {
  try {
    const sessionId = await ensureSessionId();

    const limit = rateLimit(`analyze:${sessionId}`, ANALYSES_PER_HOUR, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `That's ${ANALYSES_PER_HOUR} analyses in an hour. Try again in a few minutes.` },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const form = await request.formData();
    const file = form.get("resume");
    const pastedText = form.get("text");
    const targetRole = readOptionalString(form.get("targetRole"), 120);

    let resumeText: string;
    let filename: string;

    if (file instanceof File && file.size > 0) {
      resumeText = await extractResumeText(await file.arrayBuffer(), file.name, file.type);
      filename = file.name;
    } else if (typeof pastedText === "string" && pastedText.trim().length > 0) {
      // The paste path is the fallback for scanned PDFs, which we can't read.
      resumeText = pastedText.trim();
      filename = "Pasted resume";
      if (resumeText.length < 200) {
        throw new UnsupportedFileError("That's not enough text to analyze — paste the full resume.");
      }
    } else {
      throw new UnsupportedFileError("Attach a resume file or paste your resume text.");
    }

    const { claims, model } = await extractClaims(resumeText, targetRole ?? undefined);
    if (claims.length === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't find any claims to test in that document. Is it a resume with experience bullets?",
        },
        { status: 422 },
      );
    }

    await attachLikelyQuestions(claims, targetRole ?? undefined);

    const analysis = await getStore().createAnalysis({
      id: newId("a"),
      sessionId,
      filename,
      targetRole,
      resumeText,
      claims,
      defensibility: defensibilityScore(claims),
      model,
      jobMatch: null,
    });

    return NextResponse.json({ id: analysis.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const QUESTION_PREVIEW_CLAIMS = 5;

/**
 * Best-effort: the report is still worth reading without the questions, so a
 * rate-limited follow-up call must not fail the whole analysis. The claim
 * detail page falls back to generating on demand.
 */
async function attachLikelyQuestions(
  claims: Awaited<ReturnType<typeof extractClaims>>["claims"],
  targetRole?: string,
): Promise<void> {
  try {
    const top = riskiest(claims, QUESTION_PREVIEW_CLAIMS);
    const questions = await generateQuestionsForClaims(top, { targetRole });
    for (const claim of claims) {
      claim.likelyQuestions = questions.get(claim.id) ?? [];
    }
  } catch (error) {
    console.warn("[analyze] question pre-generation skipped", error);
  }
}

function readOptionalString(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}
