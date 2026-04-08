import axios, { type InternalAxiosRequestConfig } from "axios";
import { getBackendUrl } from "services/backendUrl";
import { getCurrentAppLanguage } from "../utils/appLanguage";
import { getApiErrorFallbackMessage } from "../messages/apiErrorFallback";

declare module "axios" {
  interface AxiosRequestConfig {
    /** When true, 401/403 do not trigger onAuthFailure or global error toast (e.g. for login/register/refresh). */
    skipAuthRedirect?: boolean;
    /** When true, failed responses do not call onError (e.g. best-effort funnel ingest). */
    skipGlobalErrorToast?: boolean;
  }
}

/** Query value used by the web app after session expiry redirect (`/login?reason=...`). */
export const HTTP_CLIENT_SESSION_EXPIRED_REASON = "session-expired";

export type HttpClientCallbacks = {
  /** Called when a 401/403 is received and the request did not set skipAuthRedirect. Host should navigate to login, clear local session, etc. */
  onAuthFailure: () => void;
  /** Called for failed API responses when skipGlobalErrorToast / skipAuthRedirect do not apply. */
  onError: (message: string) => void;
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

// Keep base URL in sync with configureBackendUrl (Expo) and env-driven web defaults.
apiClient.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  const lang = getCurrentAppLanguage();
  config.headers.set("Accept-Language", lang);
  config.headers.set("X-App-Language", lang);
  return config;
});

let didTriggerAuthRedirect = false;

const isAuthError = (error: { response?: { status?: number } }) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
};

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
    if (!skipGlobalErrorToast) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        getApiErrorFallbackMessage();
      callbacks.onError(String(message));
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
