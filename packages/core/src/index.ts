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
  setClientPlatform,
  attachToken,
  HTTP_CLIENT_SESSION_EXPIRED_REASON,
} from "./services/httpClient";
export { default as apiClient } from "./services/httpClient";
// Re-export so app code can type-narrow API errors without importing axios
// directly (axios is owned by the core http layer).
export { isAxiosError } from "axios";

export * from "./services/authService";
export * from "./services/userService";
export type { FeedbackPayload, AppReviewPayload } from "./services/userService";
export * from "./services/duelsService";
export * from "./services/socialService";
export {
  recordFunnelEvent,
  fetchFunnelMetrics,
} from "./services/analyticsService";
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
  ExerciseExplainQuotaError,
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

export {
  configureAnalyticsAdapter,
  initAnalytics,
  trackAnalyticsEvent,
} from "./services/analyticsCore";
export type { AnalyticsAdapter } from "./services/analyticsCore";
export { ANALYTICS_EVENTS } from "./types/analytics";
export type { AnalyticsEvent } from "./types/analytics";

export { initGarzoniI18n, i18n, normalizeLanguage } from "./i18n";
export {
  setAppLanguageResolver,
  getCurrentAppLanguage,
} from "./utils/appLanguage";

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
  garzoniDemoPosterUrl,
  garzoniDemoVideoUrl,
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
export {
  buildProgressByCourse,
  getCourseMetrics,
  derivePersonalizedPathState,
  shouldAutoRefreshEmptyPath,
  buildSkillPracticeHref,
  getNextPersonalizedPathCourse,
} from "./lib/personalizedPath";
export type {
  PersonalizedPathMetrics,
  PersonalizedPathCourseProgress,
} from "./lib/personalizedPath";
export { computeCourseProgress } from "./lib/courseProgress";
export type { CourseProgress, CourseProgressInput } from "./lib/courseProgress";
export { createMutationOptions } from "./lib/createMutation";
export {
  selectPrimaryCTA,
  type SelectPrimaryCtaOptions,
} from "./lib/primaryCtaSelector";

export { useHearts } from "./hooks/useHearts";
export { useProgress } from "./hooks/useProgress";
export { useProgressSummaryQuery } from "./hooks/useProgressSummaryQuery";
export { useDashboardSummary } from "./hooks/useDashboardSummary";
export { useWhatsNext } from "./hooks/useWhatsNext";
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
export { mergeMissionDeltas } from "./engagement/missionDeltas";
export {
  APP_OPENED_LAST_YMD_KEY,
  todayYmdLocal,
  shouldFireAppOpened,
  runAppOpenedDailyGate,
} from "./engagement/appOpenedDaily";
export type { AppOpenedGateAdapter } from "./engagement/appOpenedDaily";
export {
  getMissionPresentation,
  resolveQuestStepRoute,
  msUntilDailyReset,
  msUntilWeeklyReset,
  countdownLabel,
} from "./engagement/missionPresentation";
export type {
  MissionPresentation,
  MissionActionKind,
  QuestStep,
  QuestStepRoute,
  CountdownLabel,
} from "./engagement/missionPresentation";
export { useOnlineSync } from "./hooks/useOnlineSync";

export type {
  UserProfile,
  ProgressSummary,
  WhatsNextAction,
  WhatsNextActionType,
  Mission,
  MissionBuckets,
  MissionDelta,
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
export {
  COURSE_TO_TOOL_CTA,
  getToolPracticeCtaForSkill,
} from "./constants/courseToolCta";
export type { ToolPracticeCta } from "./constants/courseToolCta";
export {
  TOOL_LEARNING_HOOKS,
  getToolLearningHook,
} from "./constants/toolLearningHooks";
export type { ToolLearningHook } from "./constants/toolLearningHooks";

export { getUserLevel, getXpTier, getNextXpTier } from "./utils/userLevel";
export type { UserLevel, XpTier } from "./utils/userLevel";
export { masteryLevelLabel } from "./utils/masteryLevels";
export type { MasteryLevelBand } from "./utils/masteryLevels";
export { weakSkillNextStepLabels } from "./utils/weakSkillNextStep";
export type {
  WeakSkillNextStep,
  WeakSkillNextStepType,
} from "./utils/weakSkillNextStep";
export { localizeSectionTitle } from "./utils/sectionTitles";

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
  fetchPlanSummary,
} from "./services/questionnaireService";
export type {
  QuestionnaireProgress,
  QuestionnaireQuestion,
  NextQuestionResponse,
  SaveAnswerRequest,
  CompletionResponse,
  PlanSummary,
  PlanSummaryGoal,
  PlanSummaryLesson,
  PlanSummaryOutcome,
} from "./services/questionnaireService";

// Journey map layout math (shared by mobile "The Climb" and the web port).
export * from "./journey/journeyLayout";
