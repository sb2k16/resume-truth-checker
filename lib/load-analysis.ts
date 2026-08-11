import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { Analysis } from "@/lib/store/types";
import { readSessionId } from "@/lib/session";

/**
 * A report URL is only readable by the browser that created it. The id is
 * unguessable, but binding to the session means a shared link can't leak
 * someone's resume by accident.
 */
export async function loadAnalysis(id: string): Promise<Analysis> {
  const [analysis, sessionId] = await Promise.all([getStore().getAnalysis(id), readSessionId()]);
  if (!analysis || !sessionId || analysis.sessionId !== sessionId) notFound();
  return analysis;
}
