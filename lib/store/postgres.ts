import { neon } from "@neondatabase/serverless";
import { JobMatch } from "@/lib/jd/schema";
import { Analysis, Interview, Store } from "./types";

type Sql = ReturnType<typeof neon>;

/**
 * neon()'s tagged template resolves to a union keyed on query options we don't
 * use, so the row shape has to be asserted at each call site.
 */
type Row = Record<string, string | number | null>;

/**
 * Claims and turns are stored as JSONB rather than normalized tables. The
 * shapes are still moving, nothing queries inside them yet, and the whole
 * record is read and written as a unit — normalizing now would buy nothing.
 */
export class PostgresStore implements Store {
  private ready: Promise<void> | null = null;

  constructor(private readonly sql: Sql) {}

  private async ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql`
        CREATE TABLE IF NOT EXISTS analyses (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          filename TEXT NOT NULL,
          target_role TEXT,
          resume_text TEXT NOT NULL,
          claims JSONB NOT NULL,
          defensibility INTEGER NOT NULL,
          model TEXT NOT NULL,
          job_match JSONB
        )`;
      // CREATE TABLE IF NOT EXISTS leaves an existing table alone, so a column
      // added after someone already has a database needs its own statement.
      await this.sql`ALTER TABLE analyses ADD COLUMN IF NOT EXISTS job_match JSONB`;
      await this.sql`
        CREATE TABLE IF NOT EXISTS interviews (
          id TEXT PRIMARY KEY,
          analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
          session_id TEXT NOT NULL,
          pressure TEXT NOT NULL,
          claim_ids JSONB NOT NULL,
          turns JSONB NOT NULL DEFAULT '[]'::jsonb,
          pending_question JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ
        )`;
      await this.sql`CREATE INDEX IF NOT EXISTS analyses_session_idx ON analyses (session_id)`;
    })();
    return this.ready;
  }

  async createAnalysis(analysis: Omit<Analysis, "createdAt">): Promise<Analysis> {
    await this.ensureSchema();
    const rows = (await this.sql`
      INSERT INTO analyses (id, session_id, filename, target_role, resume_text, claims, defensibility, model)
      VALUES (${analysis.id}, ${analysis.sessionId}, ${analysis.filename}, ${analysis.targetRole},
              ${analysis.resumeText}, ${JSON.stringify(analysis.claims)}, ${analysis.defensibility}, ${analysis.model})
      RETURNING created_at`) as Row[];
    return { ...analysis, createdAt: toIso(rows[0].created_at) };
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    await this.ensureSchema();
    const rows = (await this.sql`SELECT * FROM analyses WHERE id = ${id}`) as Row[];
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      createdAt: toIso(row.created_at),
      filename: String(row.filename),
      targetRole: row.target_role === null ? null : String(row.target_role),
      resumeText: String(row.resume_text),
      claims: row.claims as unknown as Analysis["claims"],
      defensibility: Number(row.defensibility),
      model: String(row.model),
      jobMatch: (row.job_match as unknown as Analysis["jobMatch"]) ?? null,
    };
  }

  async saveJobMatch(analysisId: string, match: JobMatch): Promise<void> {
    await this.ensureSchema();
    await this.sql`
      UPDATE analyses SET job_match = ${JSON.stringify(match)} WHERE id = ${analysisId}`;
  }

  async createInterview(
    interview: Omit<Interview, "createdAt" | "turns" | "completedAt">,
  ): Promise<Interview> {
    await this.ensureSchema();
    const rows = (await this.sql`
      INSERT INTO interviews (id, analysis_id, session_id, pressure, claim_ids, pending_question)
      VALUES (${interview.id}, ${interview.analysisId}, ${interview.sessionId}, ${interview.pressure},
              ${JSON.stringify(interview.claimIds)}, ${JSON.stringify(interview.pendingQuestion)})
      RETURNING created_at`) as Row[];
    return {
      ...interview,
      turns: [],
      completedAt: null,
      createdAt: toIso(rows[0].created_at),
    };
  }

  async getInterview(id: string): Promise<Interview | null> {
    await this.ensureSchema();
    const rows = (await this.sql`SELECT * FROM interviews WHERE id = ${id}`) as Row[];
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      analysisId: String(row.analysis_id),
      sessionId: String(row.session_id),
      pressure: row.pressure as Interview["pressure"],
      claimIds: row.claim_ids as unknown as string[],
      turns: row.turns as unknown as Interview["turns"],
      pendingQuestion: row.pending_question as unknown as Interview["pendingQuestion"],
      createdAt: toIso(row.created_at),
      completedAt: row.completed_at ? toIso(row.completed_at) : null,
    };
  }

  async saveInterview(interview: Interview): Promise<void> {
    await this.ensureSchema();
    await this.sql`
      UPDATE interviews
      SET turns = ${JSON.stringify(interview.turns)},
          pending_question = ${JSON.stringify(interview.pendingQuestion)},
          completed_at = ${interview.completedAt}
      WHERE id = ${interview.id}`;
  }
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
