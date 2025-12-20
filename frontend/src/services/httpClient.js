import axios from "axios";
import toast from "react-hot-toast";
import { BACKEND_URL } from "services/backendUrl";

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

const AUTH_EXPIRED_REASON = "session-expired";
const REFRESH_STORAGE_KEY = "monevo:refresh-token";
const ACCESS_STORAGE_KEY = "monevo:access-token";
const LOGOUT_FLAG_KEY = "monevo:manual-logout";

let didTriggerAuthRedirect = false;

const isAuthError = (error) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
};

const clearStoredAuth = () => {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    sessionStorage.removeItem(ACCESS_STORAGE_KEY);
    sessionStorage.removeItem(LOGOUT_FLAG_KEY);
  } catch (_) {
    // ignore storage failures (private mode, blocked, etc.)
  }
};

const clearAuthHeaders = () => {
  delete axios.defaults.headers.common.Authorization;
  delete apiClient.defaults.headers.common.Authorization;
};

const redirectToLoginWithReason = (reason) => {
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
    if (isAuthError(error)) {
      clearStoredAuth();
      clearAuthHeaders();
      // Let the login page show the message; avoid toasts that may never be seen before redirect.
      redirectToLoginWithReason(AUTH_EXPIRED_REASON);
      return Promise.reject(error);
    }

    const message =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong. Please try again.";
    toast.error(message);
    return Promise.reject(error);
  }
);

export const attachToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export default apiClient;
