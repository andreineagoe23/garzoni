import axios, { type InternalAxiosRequestConfig } from "axios";
import { getBackendUrl } from "services/backendUrl";
import { getCurrentAppLanguage } from "../utils/appLanguage";
import { getApiErrorFallbackMessage } from "../messages/apiErrorFallback";

declare module "axios" {
  interface AxiosRequestConfig {
    /** When true, a 401 does not trigger onAuthFailure, and no global error toast is shown (e.g. for login/register/refresh). */
    skipAuthRedirect?: boolean;
    /** When true, failed responses do not call onError (e.g. best-effort funnel ingest). */
    skipGlobalErrorToast?: boolean;
  }
}

/** Query value used by the web app after session expiry redirect (`/login?reason=...`). */
export const HTTP_CLIENT_SESSION_EXPIRED_REASON = "session-expired";

export type HttpClientCallbacks = {
  /** Called when a 401 is received and the request did not set skipAuthRedirect. Host should navigate to login, clear local session, etc. */
  onAuthFailure: () => void;
  /** Called for failed API responses when skipGlobalErrorToast / skipAuthRedirect do not apply. */
  onError: (
    message: string,
    meta?: {
      status?: number;
      method?: string;
      url?: string;
      requestId?: string;
    },
  ) => void;
};

const noop = () => {};

let callbacks: HttpClientCallbacks = {
  onAuthFailure: noop,
  onError: noop,
};

/**
 * Wire platform behavior (browser redirect + toast, mobile alert, etc.).
 * Call once at app startup for each host (web, native).
 */
export function configureHttpClient(next: Partial<HttpClientCallbacks>): void {
  callbacks = {
    onAuthFailure: next.onAuthFailure ?? callbacks.onAuthFailure,
    onError: next.onError ?? callbacks.onError,
  };
}

/**
 * Single HTTP client for all backend API calls. Use this instead of raw axios + getBackendUrl()
 * so that auth headers, i18n headers, 401/403 handling, and error reporting are consistent.
 * Authenticated requests use `Authorization: Bearer` via {@link attachToken}; cookies are not required.
 */
const apiClient = axios.create({
  baseURL: getBackendUrl(),
  withCredentials: false,
});

// Originating client, stamped on every request so the backend can attribute funnel
// analytics by platform. Set once at startup via {@link setClientPlatform} ("web" from
// the web bundle, "ios"/"android" from mobile). Reporting-only, not an auth signal.
let clientPlatform = "";

/** Declare which client this bundle is. Call once at app startup. */
export function setClientPlatform(platform: string): void {
  clientPlatform = (platform || "").trim().toLowerCase();
}

// Keep base URL in sync with configureBackendUrl (Expo) and env-driven web defaults.
apiClient.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  const lang = getCurrentAppLanguage();
  config.headers.set("Accept-Language", lang);
  config.headers.set("X-App-Language", lang);
  if (clientPlatform) {
    config.headers.set("X-Garzoni-Platform", clientPlatform);
  }
  return config;
});

let didTriggerAuthRedirect = false;

/**
 * Only 401 means the session is gone: the API authenticates with JWT alone, so a missing or
 * expired token is always 401. A 403 is a logged-in user without access (e.g. an upgrade-required
 * learning path) — logging them out turned a new free signup into "session expired".
 */
const isAuthError = (error: { response?: { status?: number } }) =>
  error.response?.status === 401;

/** Upgrade-required 403s carry `required_plan`; the screen shows its own upgrade prompt. */
const isUpgradeRequired = (error: {
  response?: { status?: number; data?: { required_plan?: unknown } };
}) =>
  error.response?.status === 403 &&
  Boolean(error.response?.data?.required_plan);

/** Aborted / superseded requests (debounced search, React Query cancellation) — do not toast. */
function shouldSilenceGlobalToast(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  const err = error as { code?: string; message?: string };
  if (err.code === "ERR_CANCELED") return true;
  const msg = String(err.message ?? "").toLowerCase();
  return msg === "canceled" || msg === "cancelled";
}

const clearAuthHeaders = () => {
  delete axios.defaults.headers.common.Authorization;
  delete apiClient.defaults.headers.common.Authorization;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const cfg = error.config as InternalAxiosRequestConfig & {
      skipAuthRedirect?: boolean;
      skipGlobalErrorToast?: boolean;
    };
    const skipAuthRedirect = cfg?.skipAuthRedirect;
    const skipGlobalErrorToast =
      Boolean(cfg?.skipGlobalErrorToast) || Boolean(skipAuthRedirect);
    if (isAuthError(error) && !skipAuthRedirect) {
      clearAuthHeaders();
      if (!didTriggerAuthRedirect) {
        didTriggerAuthRedirect = true;
        callbacks.onAuthFailure();
      }
      return Promise.reject(error);
    }
    if (
      !skipGlobalErrorToast &&
      !shouldSilenceGlobalToast(error) &&
      !isUpgradeRequired(error)
    ) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        getApiErrorFallbackMessage();
      const responseHeaders = error.response?.headers as
        Record<string, string | string[] | undefined> | undefined;
      const requestIdHeader =
        responseHeaders?.["x-request-id"] ?? responseHeaders?.["X-Request-ID"];
      const requestId =
        typeof requestIdHeader === "string"
          ? requestIdHeader
          : Array.isArray(requestIdHeader)
            ? requestIdHeader[0]
            : undefined;
      callbacks.onError(String(message), {
        status: error.response?.status,
        method: String(cfg?.method || "get").toUpperCase(),
        url: String(cfg?.url || ""),
        requestId,
      });
    }
    return Promise.reject(error);
  },
);

export const attachToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export default apiClient;
