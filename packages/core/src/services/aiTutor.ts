import apiClient from "./httpClient";

type AiTutorMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiTutorExerciseContext = {
  exerciseId: number;
  question: string;
  userAnswer: string;
};

type AiTutorOptions = {
  chatHistory?: AiTutorMessage[];
  temperature?: number;
  exerciseContext?: AiTutorExerciseContext;
  source?: "chat" | "exercise_hint" | "exercise_explain" | "quick_reply";
};

export type ExplainResult = {
  explanation: string;
  practice_question: {
    question: string;
    type: string;
    choices?: string[];
    correct_answer?: string;
    explanation?: string;
  } | null;
};

export type AiTutorLink = {
  text: string;
  path: string;
  icon?: string | null;
};

export type AiTutorPayload = {
  text: string;
  link: AiTutorLink | null;
  links: AiTutorLink[] | null;
};

export async function requestAiTutorResponse(
  prompt: string,
  options: AiTutorOptions = {},
): Promise<string> {
  const payload = await requestAiTutorPayload(prompt, options);
  return payload.text;
}

export async function requestAiTutorPayload(
  prompt: string,
  options: AiTutorOptions = {},
): Promise<AiTutorPayload> {
  const response = await apiClient.post("/proxy/openai/", {
    inputs: prompt,
    parameters: {
      temperature: options.temperature ?? 0.4,
    },
    source: options.source ?? "chat",
    ...(options.exerciseContext
      ? {
          exercise_context: {
            question: options.exerciseContext.question,
            user_answer: options.exerciseContext.userAnswer,
          },
        }
      : {}),
  });

  const data = response?.data ?? {};
  return {
    text: String(data.response || "").trim(),
    link: data.link ?? null,
    links: Array.isArray(data.links) ? data.links : null,
  };
}

/**
 * Thrown by `explainExercise` when the `ai_explain` entitlement is exhausted
 * (free-tier daily cap) or requires an upgrade. Callers should catch this
 * specifically and fall back to `requestAiTutorHint` — never show an upsell
 * mid-lesson for this signal.
 */
export class ExerciseExplainQuotaError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("exercise_explain_quota_exceeded");
    this.name = "ExerciseExplainQuotaError";
    this.status = status;
  }
}

/**
 * Fetch an AI Socratic explanation for a wrong exercise answer.
 * Calls POST /api/exercises/explain/
 *
 * Resolves `null` on generic/network failures (existing callers already
 * treat that as "silently show nothing"). Throws `ExerciseExplainQuotaError`
 * specifically when the entitlement is exhausted (402/429) so callers that
 * care can fall back to the static hint tiers instead.
 */
export async function explainExercise(params: {
  exerciseQuestion: string;
  exerciseType?: string;
  correctAnswer?: unknown;
  userAnswer: unknown;
  skill?: string | null;
  exerciseId?: number | string | null;
}): Promise<ExplainResult | null> {
  try {
    const response = await apiClient.post("/exercises/explain/", {
      exercise_question: params.exerciseQuestion,
      exercise_type: params.exerciseType ?? "multiple_choice",
      correct_answer: params.correctAnswer ?? null,
      user_answer: params.userAnswer,
      skill: params.skill ?? null,
      exercise_id: params.exerciseId ?? null,
    });
    const d = response?.data ?? {};
    if (!d.explanation) return null;
    return {
      explanation: String(d.explanation),
      practice_question: d.practice_question ?? null,
    };
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 402 || status === 429) {
      throw new ExerciseExplainQuotaError(status);
    }
    return null;
  }
}

/**
 * Fetch a progressive hint for an exercise from the backend hint endpoint.
 * Calls POST /api/exercises/{exerciseId}/hint/ (ExerciseViewSet.hint action).
 */
export async function requestAiTutorHint(
  exerciseId: number | string,
  attemptNumber: number,
  userAnswerSoFar?: unknown,
): Promise<string> {
  const response = await apiClient.post(`/exercises/${exerciseId}/hint/`, {
    attempt_number: attemptNumber,
    user_answer_so_far: userAnswerSoFar ?? null,
  });
  return String(response?.data?.hint || "").trim();
}
