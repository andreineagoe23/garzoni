import apiClient from "./httpClient";

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

export const fetchQuestionnaireProgress = () =>
  apiClient.get<QuestionnaireProgress>("/questionnaire/progress/");

export const fetchNextQuestion = () =>
  apiClient.get<NextQuestionResponse>("/questionnaire/next-question/");

export const saveAnswer = (data: SaveAnswerRequest) =>
  apiClient.post<QuestionnaireProgress>("/questionnaire/save-answer/", data);

export const completeQuestionnaire = (idempotencyKey?: string) =>
  apiClient.post<CompletionResponse>("/questionnaire/complete/", {
    idempotency_key: idempotencyKey,
  });

export const abandonQuestionnaire = () =>
  apiClient.post<QuestionnaireProgress>("/questionnaire/abandon/");

