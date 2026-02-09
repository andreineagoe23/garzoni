import apiClient from "./httpClient";

/**
 * Questionnaire progress and answers are persisted only on the backend.
 * No localStorage or sessionStorage is used for questionnaire data.
 */

export interface QuestionnaireProgress {
  id: number;
  version: number;
  status: "in_progress" | "completed" | "abandoned";
  current_section_index: number;
  current_question_index: number;
  answers: Record<string, unknown>;
  section_answers: Record<string, Record<string, unknown>>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  rewards_granted: boolean;
  progress_percentage: number;
  completed_sections_count: number;
  total_sections: number;
  total_questions?: number;
  current_question_number?: number;
}

export interface QuestionnaireQuestion {
  id: string;
  type: string;
  text: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  skip_if?: {
    field: string;
    operator: string;
    value: unknown;
  };
}

export interface NextQuestionResponse {
  question: QuestionnaireQuestion;
  section_index: number;
  question_index: number;
  total_sections: number;
  total_questions_in_section: number;
  total_questions?: number;
  current_question_number?: number;
  progress_percentage: number;
  is_last_question: boolean;
  section_summary?: {
    section_title: string;
    answers: Array<{ question: string; answer: string }>;
  };
}

export interface SaveAnswerRequest {
  question_id: string;
  answer: unknown;
  section_index: number;
  question_index: number;
  time_spent_seconds?: number;
}

export interface CompletionResponse {
  message: string;
  progress: QuestionnaireProgress;
  rewards: {
    xp: number;
    coins: number;
  };
}

export const fetchQuestionnaireProgress = (): Promise<QuestionnaireProgress> =>
  apiClient.get<QuestionnaireProgress>("/questionnaire/progress/").then((r) => r.data);

export const fetchNextQuestion = (): Promise<NextQuestionResponse> =>
  apiClient.get<NextQuestionResponse>("/questionnaire/next-question/").then((r) => r.data);

export const saveAnswer = (data: SaveAnswerRequest): Promise<QuestionnaireProgress> =>
  apiClient.post<QuestionnaireProgress>("/questionnaire/save-answer/", data).then((r) => r.data);

export const completeQuestionnaire = (idempotencyKey?: string): Promise<CompletionResponse> =>
  apiClient
    .post<CompletionResponse>("/questionnaire/complete/", {
      idempotency_key: idempotencyKey })
    .then((r) => r.data);

export const abandonQuestionnaire = (): Promise<QuestionnaireProgress> =>
  apiClient.post<QuestionnaireProgress>("/questionnaire/abandon/").then((r) => r.data);
