/**
 * Optional Customer.io CDP SDK (native). Rebuild dev client after adding the dependency.
 *
 * - EXPO_PUBLIC_CIO_CDP_API_KEY (required to enable)
 * - EXPO_PUBLIC_CIO_SITE_ID (optional; enables in-app when set)
 * - EXPO_PUBLIC_CIO_REGION=us|eu
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform, TurboModuleRegistry } from "react-native";

const SITE_ID = process.env.EXPO_PUBLIC_CIO_SITE_ID?.trim();
const CDP_KEY = process.env.EXPO_PUBLIC_CIO_CDP_API_KEY?.trim();
const REGION = (process.env.EXPO_PUBLIC_CIO_REGION || "us").toLowerCase();

let initPromise: Promise<void> | null = null;
let nativeAvailable = true;

function decodeJwtUserId(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = globalThis.atob(b64 + pad);
    const payload = JSON.parse(json) as { user_id?: number | string };
    if (payload.user_id === undefined || payload.user_id === null) return null;
    return String(payload.user_id);
  } catch {
    return null;
  }
}

/**
 * Every TurboModule spec `customerio-reactnative`'s entry point pulls in. All
 * of them use `getEnforcing`, so the package throws while it is still being
 * required if the binary is missing any single one.
 */
const CIO_NATIVE_SPECS = [
  "NativeCustomerIO",
  "NativeCustomerIOLiveActivities",
  "NativeCustomerIOLogging",
  "NativeCustomerIOMessagingInApp",
  "NativeCustomerIOMessagingPush",
] as const;

/**
 * Which Customer.io specs are missing from this binary?
 *
 * The SDK's entry point eagerly pulls in every spec, and those use
 * `TurboModuleRegistry.getEnforcing`, which throws an Invariant Violation when
 * the native side is absent. Merely `require`-ing the package in a binary that
 * predates the dependency therefore red-screens — the throw reaches LogBox
 * before our catch can turn it into a warning.
 *
 * Probing only `NativeCustomerIO` was not enough. A dev client can carry an
 * older CIO pod that registers the main module but not the newer ones, so the
 * probe passed, the require ran anyway, and LiveActivities threw — which is
 * exactly what a stale dev client does. Check all of them.
 */
function missingCustomerIoSpecs(): string[] {
  try {
    return CIO_NATIVE_SPECS.filter((n) => TurboModuleRegistry.get(n) == null);
  } catch {
    return [...CIO_NATIVE_SPECS];
  }
}

export async function initCustomerIoMobile(): Promise<void> {
  if (!CDP_KEY) {
    if (__DEV__) {
      console.warn(
        "[Customer.io] EXPO_PUBLIC_CIO_CDP_API_KEY not set — SDK disabled, no push delivery via CIO",
      );
    }
    return;
  }
  const missing = missingCustomerIoSpecs();
  if (missing.length > 0) {
    nativeAvailable = false;
    if (__DEV__) {
      console.warn(
        `[Customer.io] native modules not in this binary (${missing.join(", ")}) — SDK skipped. ` +
          "Rebuild the dev client (npx expo run:ios) after adding or changing " +
          "native dependencies; `expo start --clear` only refreshes JS.",
      );
    }
    return;
  }
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const cio =
        require("customerio-reactnative") as typeof import("customerio-reactnative");
      await cio.CustomerIO.initialize({
        cdpApiKey: CDP_KEY,
        region: REGION === "eu" ? cio.CioRegion.EU : cio.CioRegion.US,
        logLevel: cio.CioLogLevel.Error,
        ...(SITE_ID ? { inApp: { siteId: SITE_ID } } : {}),
      });
      if (__DEV__) {
        console.log(
          `[Customer.io] init ok region=${REGION} inApp=${SITE_ID ? "on" : "off"}`,
        );
      }
    } catch (e) {
      nativeAvailable = false;
      console.warn("[Customer.io] initialize failed:", e);
    }
  })();
  return initPromise;
}

export async function identifyGarzoniUserFromAccessToken(
  accessToken: string,
  traits?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!CDP_KEY || !nativeAvailable) return;
  const userId = decodeJwtUserId(accessToken);
  if (!userId) return;
  await initCustomerIoMobile();
  // Do NOT auto-stamp last_active_at here. Cold starts and hydration are
  // passive presence (last_seen_at on the backend), not user activity.
  // last_active_at must only update on real user actions (login, lesson done)
  // or CIO inactivity segments never trigger. Callers that represent a real
  // login event must pass last_active_at explicitly in traits.
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.identify({
      userId,
      traits: traits ?? {},
    });
  } catch {
    /* noop */
  }
}

/** Remove device from Customer.io without clearing identify (e.g. user disabled push in Settings). */
export async function deleteCustomerIoDeviceTokenOnly(): Promise<void> {
  if (!CDP_KEY || !nativeAvailable) return;
  await initCustomerIoMobile();
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.deleteDeviceToken();
  } catch {
    /* noop */
  }
}

export async function clearGarzoniCustomerIo(): Promise<void> {
  if (!CDP_KEY || !nativeAvailable) return;
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.deleteDeviceToken();
  } catch {
    /* noop */
  }
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.clearIdentify();
  } catch {
    /* noop */
  }
}

/**
 * Associate the Expo push token with Customer.io for the current profile.
 * Call after {@link identifyGarzoniUserFromAccessToken} so the device is linked to the right person.
 */
export async function registerPushTokenWithCustomerIo(
  expoPushToken: string,
): Promise<void> {
  const t = expoPushToken?.trim();
  if (!CDP_KEY || !nativeAvailable || !t) return;
  await initCustomerIoMobile();
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.registerDeviceToken(t);
  } catch (e) {
    if (__DEV__) {
      console.warn("[Customer.io] registerDeviceToken failed:", e);
    }
  }
}

/** Product / lifecycle events for journeys (keep payloads small, no PII). */
export async function trackGarzoniEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!CDP_KEY || !nativeAvailable) return;
  await initCustomerIoMobile();
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.track(name, {
      platform: Platform.OS,
      ...(properties ?? {}),
    });
  } catch {
    /* noop */
  }
}

/** Track a screen-style event for journeys (no PII in name). */
export async function trackCioScreen(name: string): Promise<void> {
  if (!CDP_KEY || !nativeAvailable) return;
  await initCustomerIoMobile();
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.screen(name, { platform: Platform.OS });
  } catch {
    /* noop */
  }
}
