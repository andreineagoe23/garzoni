import axios, { type InternalAxiosRequestConfig } from "axios";
import toast from "react-hot-toast";
import i18n from "../i18n";
import { BACKEND_URL } from "services/backendUrl";

declare module "axios" {
  interface AxiosRequestConfig {
    /** When true, 401/403 do not trigger redirect to login or global error toast (e.g. for login/register/refresh). */
    skipAuthRedirect?: boolean;
    /** When true, failed responses do not open the global error toast (e.g. best-effort funnel ingest). */
    skipGlobalErrorToast?: boolean;
  }
}

/**
 * Read a cookie value by name.
 * Used to extract the Django CSRF token for state-changing requests.
 */
export function getCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Single HTTP client for all backend API calls. Use this instead of raw axios + BACKEND_URL
 * so that auth headers, CSRF headers, i18n headers, 401/403 handling, and error toasts are consistent.
 */
const apiClient = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

const AUTH_EXPIRED_REASON = "session-expired";

/** HTTP methods that mutate state and therefore require a CSRF token. */
const CSRF_UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

// Send current UI language so the backend can return translated content
apiClient.interceptors.request.use((config) => {
  const lang = typeof i18n?.language === "string" ? i18n.language : "en";
  config.headers.set("Accept-Language", lang);
  config.headers.set("X-App-Language", lang);

  // Attach CSRF token for all unsafe methods so cookie-authenticated endpoints
  // (refresh, logout) are protected against CSRF.
  const method = (config.method ?? "").toLowerCase();
  if (CSRF_UNSAFE_METHODS.has(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      config.headers.set("X-CSRFToken", csrfToken);
    }
  }

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

const redirectToLoginWithReason = (reason: string) => {
  if (typeof window === "undefined") return;
  if (didTriggerAuthRedirect) return;

  // Avoid redirect loops if we're already on the login page.
  const currentPath = window.location?.pathname || "";
  if (currentPath.startsWith("/login")) return;

  didTriggerAuthRedirect = true;
  window.location.assign(`/login?reason=${encodeURIComponent(reason)}`);
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
      redirectToLoginWithReason(AUTH_EXPIRED_REASON);
      return Promise.reject(error);
    }
    if (!skipGlobalErrorToast) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        i18n.t("shared.apiError");
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export const attachToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export default apiClient;
