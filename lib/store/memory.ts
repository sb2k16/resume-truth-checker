import { JobMatch } from "@/lib/jd/schema";
import { Analysis, Interview, Store } from "./types";

const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Zero-config store so the app runs with nothing but an LLM key. Data lives for
 * one server process, which is exactly the anonymous-session lifetime anyway —
 * set DATABASE_URL to keep analyses across restarts and across serverless
 * instances.
 */
export class MemoryStore implements Store {
  private readonly analyses = new Map<string, { value: Analysis; expires: number }>();
  private readonly interviews = new Map<string, { value: Interview; expires: number }>();

  async createAnalysis(analysis: Omit<Analysis, "createdAt">): Promise<Analysis> {
    const record: Analysis = { ...analysis, createdAt: new Date().toISOString() };
    this.analyses.set(record.id, { value: record, expires: Date.now() + TTL_MS });
    this.sweep();
    return record;
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    return this.read(this.analyses, id);
  }

  async saveJobMatch(analysisId: string, match: JobMatch): Promise<void> {
    const entry = this.analyses.get(analysisId);
    if (!entry) return;
    entry.value = { ...entry.value, jobMatch: match };
  }

  async createInterview(
    interview: Omit<Interview, "createdAt" | "turns" | "completedAt">,
  ): Promise<Interview> {
    const record: Interview = {
      ...interview,
      turns: [],
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.interviews.set(record.id, { value: record, expires: Date.now() + TTL_MS });
    return record;
  }

  async getInterview(id: string): Promise<Interview | null> {
    return this.read(this.interviews, id);
  }

  async saveInterview(interview: Interview): Promise<void> {
    this.interviews.set(interview.id, {
      value: interview,
      expires: Date.now() + TTL_MS,
    });
  }

  private read<T>(map: Map<string, { value: T; expires: number }>, id: string): T | null {
    const entry = map.get(id);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      map.delete(id);
      return null;
    }
    return entry.value;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.analyses) {
      if (entry.expires < now) this.analyses.delete(key);
    }
    for (const [key, entry] of this.interviews) {
      if (entry.expires < now) this.interviews.delete(key);
    }
  }
}
