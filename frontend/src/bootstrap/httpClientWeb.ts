import toast from "react-hot-toast";
import {
  configureHttpClient,
  HTTP_CLIENT_SESSION_EXPIRED_REASON,
} from "services/httpClient";

/**
 * Browser-specific httpClient behavior (toast + hard navigation on auth expiry).
 */
export function initHttpClientWeb(): void {
  configureHttpClient({
    onAuthFailure: () => {
      if (typeof window === "undefined") return;
      const path = window.location?.pathname || "";
      if (path.startsWith("/login")) return;
      window.location.assign(
        `/login?reason=${encodeURIComponent(HTTP_CLIENT_SESSION_EXPIRED_REASON)}`
      );
    },
    onError: (message) => {
      toast.error(message);
    },
  });
}
