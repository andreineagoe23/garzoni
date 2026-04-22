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
  source?: "chat" | "exercise_hint" | "quick_reply";
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
    chatHistory: options.chatHistory ?? [],
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
