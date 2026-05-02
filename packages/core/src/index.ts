/**
 * @garzoni/core — shared API client, i18n, services, and stores for web and native.
 * Metro must map `@garzoni/core` → `packages/core/src` and resolve `services/*`, `constants/*`, etc.
 */

import {
  fetchLearningPaths,
  fetchLearningPathCourses,
  fetchCourseById,
  fetchLesson,
} from "./services/userService";

export {
  configureHttpClient,
  attachToken,
  HTTP_CLIENT_SESSION_EXPIRED_REASON,
} from "./services/httpClient";
export { default as apiClient } from "./services/httpClient";

export * from "./services/authService";
export * from "./services/userService";
export type { FeedbackPayload } from "./services/userService";
export {
  fetchEntitlements,
  consumeEntitlement,
  FEATURE_COPY,
} from "./services/entitlementsService";
export {
  requestAiTutorResponse,
  requestAiTutorPayload,
  requestAiTutorHint,
  explainExercise,
} from "./services/aiTutor";
export type {
  AiTutorLink,
  AiTutorPayload,
  AiTutorExerciseContext,
  ExplainResult,
} from "./services/aiTutor";
export {
  updateAvatar,
  AVATAR_STYLES,
  getDicebearUrl,
  randomSeed,
} from "./services/avatarService";
export type {
  AvatarStyleId,
  AvatarUpdateResponse,
} from "./services/avatarService";
export {
  fetchStockQuote,
  fetchForexQuote,
  fetchCryptoQuote,
  resolveCryptoId,
  cryptoDisplayName,
  normalizeCurrencyCode,
} from "./services/marketData";
export type {
  StockQuote,
  ForexQuote,
  CryptoQuote,
} from "./services/marketData";

export { initGarzoniI18n, i18n, normalizeLanguage } from "./i18n";

export { useProgressStore } from "./stores/progressStore";

export {
  configureStorage,
  getStorageAdapter,
  storageGet,
  storageSet,
  storageRemove,
} from "./stores/storageAdapter";
export type { StorageAdapter } from "./stores/storageAdapter";

export { useHeartsStore, initHeartsTabSync } from "./stores/heartsStore";

export {
  BACKEND_URL,
  configureBackendUrl,
  getBackendUrl,
  getMediaBaseUrl,
  GOOGLE_OAUTH_CLIENT_ID,
} from "./services/backendUrl";

export {
  Images,
  authLogoBlackRectangularUrl,
  authLogoRectangleNoBgUrl,
  authLogoWhiteBgUrl,
  authLogoWhiteRectangularUrl,
  cloudinaryImageUrl,
  configureCloudinaryCloudName,
  mascotImageUrl,
} from "./images";
export type { MascotImageId } from "./images";

export {
  queryClient,
  queryKeys,
  staleTimes,
  defaultRetry,
  defaultRetryDelay,
} from "./lib/reactQuery";
export { createMutationOptions } from "./lib/createMutation";
export {
  selectPrimaryCTA,
  type SelectPrimaryCtaOptions,
} from "./lib/primaryCtaSelector";

export { useHearts } from "./hooks/useHearts";
export { useProgress } from "./hooks/useProgress";
export { useProgressSummaryQuery } from "./hooks/useProgressSummaryQuery";
export { useDashboardSummary } from "./hooks/useDashboardSummary";
export { useRetry } from "./hooks/useRetry";
export { useMascotMessage } from "./hooks/useMascotMessage";
export type {
  MascotMood,
  MascotType,
  MascotSituation,
  UseMascotMessageOptions,
} from "./hooks/useMascotMessage";
export {
  resolveMascotPresentation,
  MASCOT_SITUATIONS,
} from "./engagement/mascotPresentation";
export type { ResolvedMascotPresentation } from "./engagement/mascotPresentation";
export { MOOD_TO_MASCOT } from "./engagement/mascotTypes";
export { useOnlineSync } from "./hooks/useOnlineSync";

export type {
  UserProfile,
  ProgressSummary,
  Mission,
  MissionBuckets,
  Entitlements,
  PersonalizedPathCourse,
  PersonalizedPathResponse,
} from "./types/api";

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "./constants/i18n";

export { MASTERY_SKILL_TO_EXERCISE_CATEGORY } from "./constants/skillToExerciseCategory";
export { COURSE_TO_TOOL_CTA } from "./constants/courseToolCta";

export { getUserLevel } from "./utils/userLevel";
export type { UserLevel } from "./utils/userLevel";

export { resolveCategoryFromSkill } from "./utils/resolveCategoryFromSkill";
export { invalidateOnlineDependentQueries } from "./lib/onlineSyncInvalidate";

export { buildStandaloneExerciseViewModel } from "./utils/standaloneExerciseViewModel";
export type { StandaloneExerciseViewModel } from "./utils/standaloneExerciseViewModel";

export const pathService = { fetchPaths: fetchLearningPaths };
export const courseService = {
  fetchForPath: fetchLearningPathCourses,
  fetchById: fetchCourseById,
};
export const lessonService = { fetchById: fetchLesson };

export {
  fetchQuestionnaireProgress,
  fetchNextQuestion,
  saveAnswer as saveQuestionnaireAnswer,
  completeQuestionnaire,
  abandonQuestionnaire,
} from "./services/questionnaireService";
export type {
  QuestionnaireProgress,
  QuestionnaireQuestion,
  NextQuestionResponse,
  SaveAnswerRequest,
  CompletionResponse,
} from "./services/questionnaireService";
