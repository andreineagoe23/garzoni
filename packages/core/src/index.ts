/**
 * @monevo/core — shared API client, i18n, services, and stores for web and native.
 * Metro must map `@monevo/core` → `packages/core/src` and resolve `services/*`, `constants/*`, etc.
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

export { initMonevoI18n, i18n, normalizeLanguage } from "./i18n";

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
  queryClient,
  queryKeys,
  staleTimes,
  defaultRetry,
  defaultRetryDelay,
} from "./lib/reactQuery";
export { createMutationOptions } from "./lib/createMutation";

export { useHearts } from "./hooks/useHearts";
export { useProgress } from "./hooks/useProgress";
export { useProgressSummaryQuery } from "./hooks/useProgressSummaryQuery";
export { useDashboardSummary } from "./hooks/useDashboardSummary";
export { useRetry } from "./hooks/useRetry";
export { useMascotMessage } from "./hooks/useMascotMessage";
export type {
  MascotMood,
  MascotType,
  UseMascotMessageOptions,
} from "./hooks/useMascotMessage";
export { useOnlineSync } from "./hooks/useOnlineSync";

export type { UserProfile, ProgressSummary } from "./types/api";

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "./constants/i18n";

export const pathService = { fetchPaths: fetchLearningPaths };
export const courseService = {
  fetchForPath: fetchLearningPathCourses,
  fetchById: fetchCourseById,
};
export const lessonService = { fetchById: fetchLesson };
