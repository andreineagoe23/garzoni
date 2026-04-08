import Constants from "expo-constants";
import { getBackendUrl } from "@garzoni/core";

/**
 * Base origin for loading web-only routes (tools, legal) in a WebView.
 */
export function getWebAppBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { webAppUrl?: string }
    | undefined;
  const fromEnv = extra?.webAppUrl?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const api = getBackendUrl()?.trim();
  if (api) {
    try {
      const u = new URL(api);
      return u.origin.replace(/\/$/, "");
    } catch {
      /* ignore */
    }
  }
  return "";
}
