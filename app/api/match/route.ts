import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractRequirements } from "@/lib/jd/extract";
import {
  coverageScore,
  interviewFocus,
  matchRequirements,
  resumeSkills,
} from "@/lib/jd/match";
import { JobMatch } from "@/lib/jd/schema";
import { getStore } from "@/lib/store";
import { ensureSessionId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const MATCHES_PER_HOUR = 10;

const bodySchema = z.object({
  analysisId: z.string().min(1),
  jdText: z.string().min(120, "Paste the whole posting — that's too short to read."),
  role: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const sessionId = await ensureSessionId();
    const body = bodySchema.parse(await request.json());

    const limit = rateLimit(`match:${sessionId}`, MATCHES_PER_HOUR, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `That's ${MATCHES_PER_HOUR} postings in an hour. Try again in a few minutes.` },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const store = getStore();
    const analysis = await store.getAnalysis(body.analysisId);
    if (!analysis || analysis.sessionId !== sessionId) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const { requirements, model } = await extractRequirements(body.jdText);
    if (requirements.length === 0) {
      return NextResponse.json(
        { error: "We couldn't find any requirements in that. Is it a job posting?" },
        { status: 422 },
      );
    }

    const matched = matchRequirements(requirements, analysis.claims, analysis.resumeText);

    const match: JobMatch = {
      role: body.role?.trim() || analysis.targetRole || "This role",
      jdText: body.jdText.slice(0, 20_000),
      requirements: matched,
      resumeSkills: resumeSkills(analysis.claims),
      focus: interviewFocus(matched),
      coverageScore: coverageScore(matched),
      model,
      createdAt: new Date().toISOString(),
    };

    await store.saveJobMatch(analysis.id, match);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
