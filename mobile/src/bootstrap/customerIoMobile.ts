/**
 * Optional Customer.io CDP SDK (native). Rebuild dev client after adding the dependency.
 *
 * - EXPO_PUBLIC_CIO_CDP_API_KEY (required to enable)
 * - EXPO_PUBLIC_CIO_SITE_ID (optional; enables in-app when set)
 * - EXPO_PUBLIC_CIO_REGION=us|eu
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from "react-native";

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

export async function initCustomerIoMobile(): Promise<void> {
  if (!CDP_KEY) {
    if (__DEV__) {
      console.warn(
        "[Customer.io] EXPO_PUBLIC_CIO_CDP_API_KEY not set — SDK disabled, no push delivery via CIO",
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
  // Always stamp last_active_at so CIO inactivity segments reset on every
  // identify call (login, hydrate, foreground). Backend writes the same trait
  // via /identify on session-creating endpoints; mobile covers warm starts
  // where the user stays signed in without re-authenticating.
  const merged: Record<string, string | number | boolean> = {
    last_active_at: Math.floor(Date.now() / 1000),
    ...(traits ?? {}),
  };
  try {
    const cio =
      require("customerio-reactnative") as typeof import("customerio-reactnative");
    await cio.CustomerIO.identify({
      userId,
      traits: merged,
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
