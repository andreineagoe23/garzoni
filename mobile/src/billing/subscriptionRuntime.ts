import Constants from "expo-constants";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import {
  fetchEntitlements,
  postRevenueCatSync,
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

export const RC_OFFERING_PLUS = "plus_subscriptions";
export const RC_OFFERING_PRO = "pro_subscriptions";

/** Candidate identifiers tried in order when resolving the Pro offering. Covers dashboard drift. */
const RC_OFFERING_PRO_CANDIDATES = [
  "pro_subscriptions",
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
    monthly: "app.garzoni.mobile.plus_monthly_v3",
    yearly: "app.garzoni.mobile.plus_yearly_v3",
  },
  pro: {
    monthly: "app.garzoni.mobile.pro_monthly_v3",
    yearly: "app.garzoni.mobile.pro_yearly_v3",
  },
} as const;

/** Every ASC product ID the app should recognise for plus/pro (add new keys when ASC adds products). */
export const PRODUCT_TO_PLAN: Record<string, "plus" | "pro"> = {
  [APPLE_PRODUCT_IDS.plus.monthly]: "plus",
  [APPLE_PRODUCT_IDS.plus.yearly]: "plus",
  [APPLE_PRODUCT_IDS.pro.monthly]: "pro",
  [APPLE_PRODUCT_IDS.pro.yearly]: "pro",
  // legacy v2 IDs (test store — keep for sandbox)
  "app.garzoni.mobile.plus_monthly_v2": "plus",
  "app.garzoni.mobile.plus_yearly_v2": "plus",
  "app.garzoni.mobile.pro_monthly_v2": "pro",
  "app.garzoni.mobile.pro_yearly_v2": "pro",
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

  if (!revenueCatSdkReady) {
    // First call — configure SDK with the user's ID (or anonymous if not known yet).
    rc.Purchases.configure({ apiKey, appUserID: normalizedUser });
    configuredUserId = normalizedUser;
    revenueCatSdkReady = true;
  } else if (normalizedUser && configuredUserId !== normalizedUser) {
    // SDK already running as anonymous or different user — logIn transfers any
    // anonymous purchases to this user so the backend sync can find them by
    // str(user.pk). Caller should await identifyRevenueCatUser() for this path.
    configuredUserId = normalizedUser;
  }
  return true;
}

/**
 * Call after configureRevenueCatForUser when the user is authenticated.
 * Uses RC's logIn to transfer any anonymous session purchases to the real
 * user ID so the backend sync endpoint can find them by str(user.pk).
 */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  const rc = getRevenueCatPurchases();
  if (!rc || !revenueCatSdkReady) return;
  try {
    const anonymous = await rc.Purchases.isAnonymous();
    if (anonymous) {
      await rc.Purchases.logIn(userId);
    }
  } catch {
    /* best-effort — purchase will still work, sync may need retry */
  }
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
 * Resolve a specific offering by identifier.
 */
export async function fetchRevenueCatOfferingByIdentifier(
  offeringId: string,
): Promise<PurchasesOffering | null> {
  const rc = getRevenueCatPurchases();
  if (!rc || !assertPurchasesReadyForOfferings()) return null;
  const offerings = await rc.Purchases.getOfferings();
  const id = offeringId.trim();
  if (id === RC_OFFERING_PLUS) {
    return offerings.all[RC_OFFERING_PLUS] ?? offerings.current ?? null;
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
  // Fallback: derive plan from active product IDs when RC entitlement names
  // don't match (e.g. RC dashboard maps pro product to wrong entitlement).
  let best: "starter" | "plus" | "pro" = "starter";
  for (const productId of ci.activeSubscriptions) {
    const p = PRODUCT_TO_PLAN[productId] ?? planFromStoreProductIdentifier(productId);
    if (p === "pro") return "pro";
    if (p === "plus") best = "plus";
  }
  return best;
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

  if (explicit && explicit !== RC_OFFERING_PLUS) {
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

/**
 * Repair backend entitlement state on app launch.
 *
 * If the user already has an active RC entitlement (e.g. previous install on
 * the same Apple ID, or a prior purchase that didn't sync) but the backend
 * thinks they're on starter, call the sync endpoint to fix it.
 *
 * Safe to call on every app launch — early-exits when not entitled or
 * already in sync.
 */
export async function syncEntitlementOnLaunch(
  queryClient: QueryClient,
  userId?: string,
): Promise<void> {
  const rc = getRevenueCatPurchases();
  if (!rc) return;
  if (!configureRevenueCatForUser(userId)) return;

  try {
    const customerInfo = await rc.Purchases.getCustomerInfo();
    const activePlan = rcGetActivePlan(customerInfo);
    if (activePlan === "starter") return; // nothing to repair

    // Check if backend already knows
    const entitlements = await queryClient
      .fetchQuery({
        queryKey: queryKeys.entitlements(),
        queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
      })
      .catch(() => null);

    if (planRank(entitlements?.plan) >= planRank(activePlan)) return; // already in sync

    // Backend out of sync — repair it. Pass RC user ID so backend can find
    // the subscriber even if the RC session is anonymous (dev/sandbox).
    const rcAppUserId = customerInfo.originalAppUserId || undefined;
    await postRevenueCatSync(rcAppUserId).catch(() => null);
    await refreshSubscriptionQueries(queryClient);
  } catch {
    /* best-effort; don't block app launch on this */
  }
}

export async function syncRevenueCatSubscription(queryClient: QueryClient) {
  // Pass the RC appUserID so the backend can look up the right subscriber,
  // even when the RC session is anonymous (e.g. dev testing before login).
  let rcAppUserId: string | undefined;
  const rc = getRevenueCatPurchases();
  if (rc && revenueCatSdkReady) {
    try {
      const ci = await rc.Purchases.getCustomerInfo();
      rcAppUserId = ci.originalAppUserId || undefined;
    } catch {
      /* best-effort */
    }
  }

  try {
    await postRevenueCatSync(rcAppUserId);
  } catch {
    // Fallback to Stripe sync (no-op for RC users but harmless)
    try {
      await postSubscriptionSync();
    } catch {
      /* best-effort; webhook will still fire and activate */
    }
  }
  void import("../bootstrap/customerIoMobile").then(({ trackGarzoniEvent }) =>
    trackGarzoniEvent("subscription_synced", {}),
  );
  await refreshSubscriptionQueries(queryClient);
}

export async function waitForActiveSubscription(
  queryClient: QueryClient,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<Entitlements | null> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const delayMs = options?.delayMs ?? 1500;

  // Fast-path: RC SDK has authoritative local entitlement data immediately
  // after a purchase. If RC says entitled, kick off backend sync async and
  // return a synthetic entitlements object so the UI shows success instantly.
  // This also handles the case where the backend user ID differs from the RC
  // user ID (e.g. anonymous RC session in dev).
  const rc = getRevenueCatPurchases();
  if (rc && revenueCatSdkReady) {
    try {
      const ci = await rc.Purchases.getCustomerInfo();
      if (rcIsEntitled(ci)) {
        const activePlan = rcGetActivePlan(ci);
        const synthetic = { plan: activePlan, entitled: true } as Entitlements;
        // Write to cache immediately so home screen sees correct plan on mount.
        queryClient.setQueryData(queryKeys.entitlements(), synthetic);
        // Background sync activates backend; refreshSubscriptionQueries will
        // then replace synthetic cache entry with real data from the server.
        void syncRevenueCatSubscription(queryClient);
        return synthetic;
      }
    } catch {
      /* fall through to backend loop */
    }
  }

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
