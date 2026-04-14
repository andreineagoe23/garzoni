import Constants from "expo-constants";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import {
  fetchEntitlements,
  postSubscriptionSync,
  queryKeys,
  type Entitlements,
} from "@garzoni/core";
import type { PurchasesOffering } from "react-native-purchases";
import { getRevenueCatPurchases } from "./safeRevenueCat";

export const PRODUCT_TO_PLAN: Record<string, "plus" | "pro"> = {
  "tech.garzoni.app.plus_monthly": "plus",
  "tech.garzoni.app.plus_yearly": "plus",
  "tech.garzoni.app.pro_monthly": "pro",
  "tech.garzoni.app.pro_yearly": "pro",
};

let configuredUserId: string | null = null;
let devVerboseLogApplied = false;

function resolveRevenueCatApiKey() {
  const extra = Constants.expoConfig?.extra as
    | {
        revenueCatApiKeyIos?: string;
        revenueCatApiKeyAndroid?: string;
      }
    | undefined;
  if (Platform.OS === "ios") return extra?.revenueCatApiKeyIos;
  if (Platform.OS === "android") return extra?.revenueCatApiKeyAndroid;
  return undefined;
}

export function configureRevenueCatForUser(userId?: string) {
  const rc = getRevenueCatPurchases();
  if (!rc) return false;
  if (__DEV__ && !devVerboseLogApplied) {
    try {
      rc.Purchases.setLogLevel(rc.LOG_LEVEL.VERBOSE);
    } catch {
      /* no-op */
    }
    devVerboseLogApplied = true;
  }
  const apiKey = resolveRevenueCatApiKey()?.trim();
  if (!apiKey) return false;

  const normalizedUser = userId ?? null;
  if (configuredUserId === normalizedUser) return true;

  rc.Purchases.configure({ apiKey, appUserID: normalizedUser });
  configuredUserId = normalizedUser;
  return true;
}

export async function clearRevenueCatSession() {
  const rc = getRevenueCatPurchases();
  configuredUserId = null;
  if (!rc) return;
  try {
    await rc.Purchases.logOut();
  } catch {
    /* no-op */
  }
}

export async function fetchRevenueCatOffering(): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc) return null;
  const offerings = await rc.Purchases.getOfferings();
  return offerings.current ?? null;
}

/**
 * Prefer RevenueCat Targeting placement when `extra.revenueCatPaywallPlacement`
 * is set (see `EXPO_PUBLIC_REVENUECAT_PAYWALL_PLACEMENT` in app config).
 * Falls back to the project default current offering.
 */
export async function fetchRevenueCatPaywallOffering(): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc) return null;
  const extra = Constants.expoConfig?.extra as
    | { revenueCatPaywallPlacement?: string }
    | undefined;
  const placement = extra?.revenueCatPaywallPlacement?.trim();
  if (placement) {
    try {
      const targeted =
        await rc.Purchases.getCurrentOfferingForPlacement(placement);
      if (targeted?.availablePackages?.length) return targeted;
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[RevenueCat] getCurrentOfferingForPlacement failed:", e);
      }
    }
  }
  return fetchRevenueCatOffering();
}

export async function refreshSubscriptionQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionPlans() });
}

function planRank(plan?: string | null) {
  if (plan === "plus") return 1;
  if (plan === "pro") return 2;
  return 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncRevenueCatSubscription(queryClient: QueryClient) {
  try {
    await postSubscriptionSync();
  } catch {
    /* best-effort; webhook may still finish activation */
  }
  await refreshSubscriptionQueries(queryClient);
}

export async function waitForActiveSubscription(
  queryClient: QueryClient,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<Entitlements | null> {
  const maxAttempts = options?.maxAttempts ?? 6;
  const delayMs = options?.delayMs ?? 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await syncRevenueCatSubscription(queryClient);
    const entitlements = await queryClient.fetchQuery({
      queryKey: queryKeys.entitlements(),
      queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    });
    if (planRank(entitlements?.plan) >= 1 || Boolean(entitlements?.entitled)) {
      return entitlements;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}
