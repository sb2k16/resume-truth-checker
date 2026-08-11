import { AnswerEvaluation, ScoredClaim } from "@/lib/claims/schema";
import { PressureLevel } from "@/lib/interview/questions";

export interface Analysis {
  id: string;
  sessionId: string;
  createdAt: string;
  filename: string;
  targetRole: string | null;
  /** Extracted text. The uploaded file itself is never stored. */
  resumeText: string;
  claims: ScoredClaim[];
  defensibility: number;
  model: string;
}

export interface InterviewTurn {
  claimId: string;
  question: string;
  answer: string;
  evaluation: AnswerEvaluation;
  askedAt: string;
}

export interface Interview {
  id: string;
  analysisId: string;
  sessionId: string;
  pressure: PressureLevel;
  /** Claims queued for this session, in order. */
  claimIds: string[];
  turns: InterviewTurn[];
  /** The question awaiting an answer, if any. */
  pendingQuestion: { claimId: string; question: string } | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Store {
  createAnalysis(analysis: Omit<Analysis, "createdAt">): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | null>;
  createInterview(
    interview: Omit<Interview, "createdAt" | "turns" | "completedAt">,
  ): Promise<Interview>;
  getInterview(id: string): Promise<Interview | null>;
  saveInterview(interview: Interview): Promise<void>;
}
