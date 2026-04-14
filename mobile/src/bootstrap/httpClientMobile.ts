import Toast from "react-native-toast-message";
import Constants from "expo-constants";
import { router } from "expo-router";
import {
  attachToken,
  apiClient,
  configureBackendUrl,
  configureCloudinaryCloudName,
  configureHttpClient,
  refreshAccessToken,
} from "@garzoni/core";
import type { InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "../auth/tokenStorage";
import { resolveBackendUrlFromExpo } from "./resolveBackendUrl";

let initialized = false;

// Token refresh queue: while a refresh is in-flight we hold concurrent 401
// requests and replay them once we have a fresh access token.
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!),
  );
  pendingQueue = [];
}

async function clearSessionAndRedirect() {
  await tokenStorage.clearAll();
  attachToken(null);
  router.replace("/login");
}

export function initHttpClientMobile() {
  if (initialized) return;
  initialized = true;

  const resolved = resolveBackendUrlFromExpo();
  if (resolved) {
    configureBackendUrl(resolved);
  } else if (__DEV__) {
    const appEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
    if (appEnv === "development") {
      console.warn(
        "[Garzoni] EXPO_PUBLIC_BACKEND_URL is not set while EXPO_PUBLIC_APP_ENV=development. " +
          "Copy mobile/.env.example to .env.development.local, set EXPO_PUBLIC_BACKEND_URL " +
          "(e.g. http://127.0.0.1:8000/api for the iOS Simulator, http://<LAN-IP>:8000/api for a device + Docker, " +
          "http://10.0.2.2:8000/api for the Android emulator), then restart Expo with --clear.",
      );
    } else {
      console.warn(
        "[Garzoni] EXPO_PUBLIC_BACKEND_URL is not set. API calls fall back to localhost and fail on real devices. " +
          "Set it in mobile/.env (see mobile/.env.example). For EAS production builds, define it in EAS project secrets.",
      );
    }
  }

  const cloudName = Constants.expoConfig?.extra?.cloudinaryCloudName;
  if (typeof cloudName === "string" && cloudName.trim()) {
    configureCloudinaryCloudName(cloudName.trim());
  }

  // onAuthFailure is intentionally a no-op here: the response interceptor
  // below handles 401s by attempting a token refresh first and only navigates
  // to /login when the refresh itself fails. The core's callback is kept as a
  // fallback for any paths where skipAuthRedirect is set.
  configureHttpClient({
    onAuthFailure: () => {
      // Handled by the refresh interceptor below.
    },
    onError: (msg, meta) => {
      const text = String(msg);
      const status = meta?.status;
      const method = String(meta?.method || "").toUpperCase();
      const isGenericServerReadFailure =
        method === "GET" &&
        status === 500 &&
        /^Request failed with status code 500$/i.test(text);
      if (isGenericServerReadFailure) {
        if (__DEV__) {
          console.warn("[Garzoni][silent-read-500]", meta?.url || "", text);
        }
        return;
      }
      Toast.show({
        type: "error",
        text1: "Error",
        text2: text.length > 280 ? `${text.slice(0, 277)}…` : text,
        position: "top",
        visibilityTime: 4500,
      });
    },
  });

  // Token auto-refresh interceptor. Added after configureHttpClient so it runs
  // after the core's error handler (Axios response interceptors are FIFO).
  // On a 401 the core handler fires first (no-op onAuthFailure), rejects the
  // promise, then this handler gets the error and attempts a silent refresh.
  apiClient.interceptors.response.use(undefined, async (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number };
      config?: InternalAxiosRequestConfig & {
        _retry?: boolean;
        skipAuthRedirect?: boolean;
      };
    };
    const originalRequest = axiosError.config;

    // Only intercept 401s we haven't already retried and that didn't opt out.
    if (
      axiosError.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.skipAuthRedirect
    ) {
      return Promise.reject(error);
    }

    // Queue concurrent 401s while a refresh is already in-flight.
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err: unknown) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const storedRefresh = await tokenStorage.getRefresh();
      if (!storedRefresh) throw new Error("no_refresh_token");

      const { data } = await refreshAccessToken(storedRefresh);
      const { access, refresh: newRefresh } = data;

      await tokenStorage.setAccess(access);
      attachToken(access);
      if (newRefresh) await tokenStorage.setRefresh(newRefresh);

      flushQueue(null, access);
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      await clearSessionAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  });
}
