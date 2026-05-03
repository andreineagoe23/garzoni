import Constants from "expo-constants";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import {
  fetchEntitlements,
  postSubscriptionSync,
  queryKeys,
  type Entitlements,
} from "@garzoni/core";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { getRevenueCatPurchases } from "./safeRevenueCat";

// ─── RevenueCat Dashboard identifiers (keep in sync with RC project) ─────────

export const RC_ENTITLEMENT_PRO = "Garzoni Pro";
export const RC_ENTITLEMENT_PLUS = "Garzoni Plus";
/** @deprecated Prefer RC_ENTITLEMENT_PRO / PLUS; kept for older imports. */
export const RC_ENTITLEMENT = RC_ENTITLEMENT_PRO;

export const RC_OFFERING_PLUS = "default";
export const RC_OFFERING_PRO = "pro";

/** Candidate identifiers tried in order when resolving the Pro offering. Covers dashboard drift. */
const RC_OFFERING_PRO_CANDIDATES = [
  "pro",
  "Garzoni Pro",
  "garzoni_pro",
  "garzoni-pro",
];

/**
 * Canonical auto-renewable subscription product IDs for **this** mobile app’s
 * bundle ID in App Store Connect. RevenueCat must reference these **exact**
 * strings on each package (RC does not mint alternate store IDs).
 *
 * If ASC and RC disagree (extra products in RC, old bundle IDs, typos), you
 * see “clashing” behaviour: paywalls show wrong prices, purchases fail, or
 * entitlements do not match. Fix in the dashboards first; then extend
 * `PRODUCT_TO_PLAN` below if you intentionally add new ASC product IDs.
 */
export const APPLE_PRODUCT_IDS = {
  plus: {
    monthly: "app.garzoni.mobile.plus_monthly_v2",
    yearly: "app.garzoni.mobile.plus_yearly_v2",
  },
  pro: {
    monthly: "app.garzoni.mobile.pro_monthly_v2",
    yearly: "app.garzoni.mobile.pro_yearly_v2",
  },
} as const;

/** Every ASC product ID the app should recognise for plus/pro (add new keys when ASC adds products). */
export const PRODUCT_TO_PLAN: Record<string, "plus" | "pro"> = {
  [APPLE_PRODUCT_IDS.plus.monthly]: "plus",
  [APPLE_PRODUCT_IDS.plus.yearly]: "plus",
  [APPLE_PRODUCT_IDS.pro.monthly]: "pro",
  [APPLE_PRODUCT_IDS.pro.yearly]: "pro",
  // legacy v1 IDs — keep so existing subscribers aren't broken
  "app.garzoni.mobile.plus_monthly": "plus",
  "app.garzoni.mobile.plus_yearly": "plus",
  "app.garzoni.mobile.pro_monthly": "pro",
  "app.garzoni.mobile.pro_yearly": "pro",
  "tech.garzoni.app.plus_monthly": "plus",
  "tech.garzoni.app.plus_yearly": "plus",
  "tech.garzoni.app.pro_monthly": "pro",
  "tech.garzoni.app.pro_yearly": "pro",
};

/**
 * Map store product id → Garzoni plan. Uses `PRODUCT_TO_PLAN` first, then a
 * fragile name heuristic for unknown ids (log in dev via paywall fetch).
 */
export function planFromStoreProductIdentifier(
  productId: string,
): "plus" | "pro" {
  const mapped = PRODUCT_TO_PLAN[productId];
  if (mapped) return mapped;
  const id = productId.toLowerCase();
  if (id.includes("pro")) return "pro";
  return "plus";
}

function devWarnIfOfferingUsesUnmappedStoreProducts(
  offering: PurchasesOffering | null,
): void {
  if (!__DEV__ || !offering?.availablePackages?.length) return;
  const unknown: string[] = [];
  for (const pkg of offering.availablePackages) {
    const id = pkg.product.identifier;
    if (!Object.prototype.hasOwnProperty.call(PRODUCT_TO_PLAN, id))
      unknown.push(id);
  }
  if (!unknown.length) return;
  const known = Object.keys(PRODUCT_TO_PLAN).join(", ");
  console.warn(
    `[Garzoni ↔ RevenueCat ↔ App Store] Offering "${offering.identifier}" returned ` +
      `store product id(s) not listed in PRODUCT_TO_PLAN: ${unknown.join(", ")}.\n` +
      `RevenueCat packages must use the **exact** product identifiers from App Store Connect ` +
      `for this app’s bundle. Remove stale products from RC offerings or add new ASC ids to PRODUCT_TO_PLAN.\n` +
      `Currently mapped ids: ${known}`,
  );
}

let configuredUserId: string | null = null;
/** True only after a successful `Purchases.configure` — required before getOfferings. */
let revenueCatSdkReady = false;
let devVerboseLogApplied = false;

let devMissingKeyWarned = false;
function resolveRevenueCatApiKey() {
  const extra = Constants.expoConfig?.extra as
    | {
        revenueCatApiKeyIos?: string;
        revenueCatApiKeyAndroid?: string;
      }
    | undefined;
  let key: string | undefined;
  if (Platform.OS === "ios") key = extra?.revenueCatApiKeyIos;
  else if (Platform.OS === "android") key = extra?.revenueCatApiKeyAndroid;
  if (__DEV__ && !key?.trim() && !devMissingKeyWarned) {
    devMissingKeyWarned = true;
    const varName =
      Platform.OS === "android"
        ? "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY"
        : "EXPO_PUBLIC_REVENUECAT_IOS_KEY";
    console.warn(
      `[RevenueCat] Missing API key. Set ${varName} in mobile/.env (or .env.development) — ` +
        `app.config.js maps it to extra.revenueCatApiKey${Platform.OS === "android" ? "Android" : "Ios"}. ` +
        `Paywall and purchases will be disabled until a key is configured.`,
    );
  }
  return key;
}

/** Whether `getOfferings` / purchases are safe to call (configure succeeded). */
export function isRevenueCatNativeConfigured(): boolean {
  return revenueCatSdkReady;
}

export function configureRevenueCatForUser(userId?: string) {
  const rc = getRevenueCatPurchases();
  if (!rc) {
    revenueCatSdkReady = false;
    return false;
  }
  if (__DEV__ && !devVerboseLogApplied) {
    try {
      rc.Purchases.setLogLevel(rc.LOG_LEVEL.VERBOSE);
    } catch {
      /* no-op */
    }
    devVerboseLogApplied = true;
  }
  const apiKey = resolveRevenueCatApiKey()?.trim();
  if (!apiKey) {
    revenueCatSdkReady = false;
    return false;
  }

  const normalizedUser = userId ?? null;
  if (revenueCatSdkReady && configuredUserId === normalizedUser) {
    return true;
  }

  rc.Purchases.configure({ apiKey, appUserID: normalizedUser });
  configuredUserId = normalizedUser;
  revenueCatSdkReady = true;
  return true;
}

export async function clearRevenueCatSession() {
  const rc = getRevenueCatPurchases();
  if (rc) {
    try {
      // RevenueCat treats $RCAnonymousID:* as anonymous; logOut() on that user
      // only logs an error ("LogOut was called but the current user is anonymous").
      const anonymous = await rc.Purchases.isAnonymous();
      if (!anonymous) {
        await rc.Purchases.logOut();
      }
    } catch {
      /* no-op */
    }
  }
  configuredUserId = null;
  revenueCatSdkReady = false;
}

function assertPurchasesReadyForOfferings(): boolean {
  if (!getRevenueCatPurchases()) return false;
  if (!resolveRevenueCatApiKey()?.trim()) return false;
  if (!revenueCatSdkReady) {
    if (__DEV__) {
      console.warn(
        "[RevenueCat] Skipping getOfferings: SDK not configured. Call configureRevenueCatForUser after a valid API key is set in app config (extra.revenueCatApiKeyIos / revenueCatApiKeyAndroid).",
      );
    }
    return false;
  }
  return true;
}

export async function fetchRevenueCatOffering(): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc || !assertPurchasesReadyForOfferings()) return null;
  const offerings = await rc.Purchases.getOfferings();
  return offerings.current ?? null;
}

/**
 * Resolve a specific offering. Plus / "default" uses `offerings.current` (RC default offering).
 */
export async function fetchRevenueCatOfferingByIdentifier(
  offeringId: string,
): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc || !assertPurchasesReadyForOfferings()) return null;
  const offerings = await rc.Purchases.getOfferings();
  const id = offeringId.trim();
  if (id === RC_OFFERING_PLUS || id === "default") {
    return offerings.current ?? offerings.all[RC_OFFERING_PLUS] ?? null;
  }
  const direct = offerings.all[id];
  if (direct) return direct;
  if (RC_OFFERING_PRO_CANDIDATES.includes(id)) {
    for (const cand of RC_OFFERING_PRO_CANDIDATES) {
      const match = offerings.all[cand];
      if (match) return match;
    }
  }
  return null;
}

export async function rcGetPackagesForOffering(
  offeringId: string,
): Promise<PurchasesPackage[]> {
  const o = await fetchRevenueCatOfferingByIdentifier(offeringId);
  return o?.availablePackages ?? [];
}

export const rcIsProEntitled = (ci: CustomerInfo) =>
  RC_ENTITLEMENT_PRO in ci.entitlements.active;

export const rcIsPlusEntitled = (ci: CustomerInfo) =>
  RC_ENTITLEMENT_PLUS in ci.entitlements.active;

export const rcIsEntitled = (ci: CustomerInfo) =>
  rcIsProEntitled(ci) || rcIsPlusEntitled(ci);

export function rcGetActivePlan(ci: CustomerInfo): "pro" | "plus" | "starter" {
  if (rcIsProEntitled(ci)) return "pro";
  if (rcIsPlusEntitled(ci)) return "plus";
  return "starter";
}

export type FetchRevenueCatPaywallOptions = {
  /** When set to `RC_OFFERING_PRO` / `"pro"`, loads the Pro storefront offering. */
  offeringId?: string;
};

/**
 * Prefer RevenueCat Targeting placement when `extra.revenueCatPaywallPlacement`
 * is set (see `EXPO_PUBLIC_REVENUECAT_PAYWALL_PLACEMENT` in app config).
 * Falls back to the project default current offering (Plus / default).
 *
 * Pass `{ offeringId: RC_OFFERING_PRO }` to load the Pro offering instead.
 */
export async function fetchRevenueCatPaywallOffering(
  options?: FetchRevenueCatPaywallOptions,
): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc || !assertPurchasesReadyForOfferings()) return null;

  const explicit = options?.offeringId?.trim();
  let result: PurchasesOffering | null = null;

  if (explicit && explicit !== RC_OFFERING_PLUS && explicit !== "default") {
    result = await fetchRevenueCatOfferingByIdentifier(explicit);
  } else {
    const extra = Constants.expoConfig?.extra as
      | { revenueCatPaywallPlacement?: string }
      | undefined;
    const placement = extra?.revenueCatPaywallPlacement?.trim();
    if (placement) {
      try {
        const targeted =
          await rc.Purchases.getCurrentOfferingForPlacement(placement);
        if (targeted?.availablePackages?.length) result = targeted;
      } catch (e) {
        if (__DEV__) {
          console.warn(
            "[RevenueCat] getCurrentOfferingForPlacement failed:",
            e,
          );
        }
      }
    }
    if (!result) {
      result = await fetchRevenueCatOffering();
    }
  }

  devWarnIfOfferingUsesUnmappedStoreProducts(result);
  return result;
}

export async function refreshSubscriptionQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.subscriptionPlans(),
  });
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
    void import("../bootstrap/customerIoMobile").then(({ trackGarzoniEvent }) =>
      trackGarzoniEvent("subscription_synced", {}),
    );
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
