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
 * Fetch an AI Socratic explanation for a wrong exercise answer.
 * Calls POST /api/exercises/explain/
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
  } catch {
    return null;
  }
}

/**
 * Fetch a progressive hint for an exercise from the backend hint endpoint.
 * Calls POST /api/education/exercises/{exerciseId}/hint/
 */
export async function requestAiTutorHint(
  exerciseId: number,
  attemptNumber: number,
  userAnswerSoFar?: unknown,
): Promise<string> {
  const response = await apiClient.post(
    `/education/exercises/${exerciseId}/hint/`,
    {
      attempt_number: attemptNumber,
      user_answer_so_far: userAnswerSoFar ?? null,
    },
  );
  return String(response?.data?.hint || "").trim();
}
