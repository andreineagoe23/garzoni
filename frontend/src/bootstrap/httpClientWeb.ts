import toast from "react-hot-toast";
import { reportApiError } from "sentry";
import {
  configureHttpClient,
  setClientPlatform,
  HTTP_CLIENT_SESSION_EXPIRED_REASON,
} from "services/httpClient";

/**
 * Browser-specific httpClient behavior (toast + hard navigation on auth expiry).
 */
export function initHttpClientWeb(): void {
  setClientPlatform("web");
  configureHttpClient({
    onAuthFailure: () => {
      if (typeof window === "undefined") return;
      const path = window.location?.pathname || "";
      if (path.startsWith("/login")) return;
      window.location.assign(
        `/login?reason=${encodeURIComponent(HTTP_CLIENT_SESSION_EXPIRED_REASON)}`
      );
    },
    onError: (message, meta) => {
      if (meta?.status != null && meta.status >= 500) {
        reportApiError(message, meta);
      }
      toast.error(message);
    },
  });
}
