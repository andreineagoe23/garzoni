import { QueryClient } from "@tanstack/react-query";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const queryKeys = {
  // Keep these as functions so callsites can't accidentally diverge.
  // When we add typing later, this pattern becomes fully type-safe.
  profile: () => ["profile"] as const,
  entitlements: () => ["entitlements"] as const,

  progressSummary: () => ["progressSummary"] as const,
  hearts: () => ["hearts"] as const,

  // Course flow / content
  courseFlow: (courseId: string | number) => ["courseFlow", courseId] as const,
  lessonsWithProgress: (courseId: string | number, mode = "learner") =>
    ["lessonsWithProgress", courseId, mode] as const,
  exercises: () => ["exercises"] as const,
  learningPathCourses: (pathId: string | number) =>
    ["learningPathCourses", pathId] as const,

  // Dashboard widgets
  reviewQueue: () => ["reviewQueue"] as const,
  masterySummary: () => ["masterySummary"] as const,
  missions: () => ["missions"] as const,

  // Other
  courses: (pathId: string | number) => ["courses", pathId] as const,
  pricingFunnelMetrics: () => ["pricingFunnelMetrics"] as const,
};

export const staleTimes = {
  // Identity/user profile: avoid refetching on every navigation; rely on explicit invalidation after mutations.
  profile: 15 * MINUTE,
  entitlements: 10 * MINUTE,

  // Progress summary is used across multiple screens; keep it fresh-ish but avoid unnecessary refetching.
  progressSummary: 5 * MINUTE,

  // Hearts: short-lived (server truth can change from other tabs / sessions).
  hearts: 15_000,

  // "Static-ish" content.
  content: 6 * HOUR,
};

export function defaultRetry(failureCount: number, error: unknown) {
  // Don't retry while offline.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  // Axios-style error shaping: error.response.status
  const errorObj = error as { response?: { status?: number } };
  const status = errorObj?.response?.status;
  // Don't retry most 4xx (except rate limiting).
  if (typeof status === "number" && status >= 400 && status < 500) {
    return status === 429 && failureCount < 2;
  }

  // Default: a couple retries for transient network errors / 5xx.
  return failureCount < 2;
}

export function defaultRetryDelay(attemptIndex: number) {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid surprise refetches for non-critical data; callers can opt-in per query.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: defaultRetry,
      retryDelay: defaultRetryDelay,
      staleTime: 5 * MINUTE,
      // v5 name; v4 ignored. Harmless across versions.
      gcTime: 30 * MINUTE,
    },
    mutations: {
      retry: defaultRetry,
      retryDelay: defaultRetryDelay,
    },
  },
});
