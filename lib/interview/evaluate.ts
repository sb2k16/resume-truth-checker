import { complete, parseJson, systemMessage, userMessage } from "@/lib/llm";
import { AnswerEvaluation, ScoredClaim, answerEvaluationSchema } from "@/lib/claims/schema";
import { PressureLevel } from "./questions";

const SYSTEM_PROMPT = `You score one interview answer about one resume claim.

Score each dimension 0-100 for THIS answer only:
- technicalDepth: does the answer show real understanding of how the thing worked?
- ownership: is it clear what this person personally did?
- metrics: are numbers given with baseline, method, and period?
- tradeoffs: do they explain alternatives and why they chose what they chose?
- communication: is the answer structured and specific rather than rambling?
- systemThinking: do they connect their piece to the wider system?

Scoring discipline:
- Score what was said, not what was probably true. "I optimized the query" with no detail is a low technicalDepth answer even if the work was real.
- An answer that says "I don't remember" or "the team did it" is not a failure of honesty — score it low on that dimension and say so plainly. Never reward invention.
- Dimensions the answer had no occasion to address get 50, not 0.

resumeIntegrityFlag: set this ONLY when the answer reveals the resume line claims more than what happened — the candidate did not lead it, the number was someone else's, the scope was smaller. Describe the mismatch and suggest wording that matches what they actually did. NEVER suggest adding numbers or detail they did not state. Otherwise null.

Respond with JSON only:
{"scores":{"technicalDepth":0,"ownership":0,"metrics":0,"tradeoffs":0,"communication":0,"systemThinking":0},"feedback":"...","resumeIntegrityFlag":null,"followUp":null}`;

const PRESSURE_CALIBRATION: Record<PressureLevel, string> = {
  friendly: "Grade generously and note what a stronger answer would add.",
  realistic: "Grade the way a hiring committee would.",
  aggressive: "Grade strictly. Unsupported assertions score low even when confident.",
};

export async function evaluateAnswer(
  claim: ScoredClaim,
  question: string,
  answer: string,
  pressure: PressureLevel = "realistic",
): Promise<AnswerEvaluation> {
  const { text } = await complete({
    messages: [
      systemMessage(`${SYSTEM_PROMPT}\n\n${PRESSURE_CALIBRATION[pressure]}`),
      userMessage(
        `RESUME CLAIM: ${claim.claim}\nRESUME LINE: ${claim.sourceLine}\n\nQUESTION: ${question}\n\nCANDIDATE ANSWER: ${answer}`,
      ),
    ],
    json: true,
    temperature: 0.1,
    maxTokens: 900,
  });

  return parseJson(text, answerEvaluationSchema);
}

/** An empty or throwaway answer shouldn't cost an LLM call to score. */
export function isNonAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (trimmed.length < 12) return true;
  return /^(idk|i don'?t know|no idea|skip|pass|n\/?a)\.?$/i.test(trimmed);
}

export function nonAnswerEvaluation(): AnswerEvaluation {
  return {
    scores: {
      technicalDepth: 0,
      ownership: 0,
      metrics: 0,
      tradeoffs: 0,
      communication: 0,
      systemThinking: 0,
    },
    feedback:
      "No substantive answer given. In a real interview this is the moment the claim stops helping you — an interviewer reads it as the line being untestable.",
    resumeIntegrityFlag: null,
    followUp: null,
  };
}
