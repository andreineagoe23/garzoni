/**
 * RevenueCat Web SDK service for Garzoni.
 *
 * Wraps @revenuecat/purchases-js with a singleton pattern so the SDK is
 * configured once per user session and reused across all billing components.
 *
 * Entitlements / offerings mirror the native app (RevenueCat Dashboard):
 *   - Garzoni Plus  → offering `plus_subscriptions` (currently the default)
 *   - Garzoni Pro   → offering `pro_subscriptions`
 * Offering + entitlement ids match mobile so a web purchase is active on
 * mobile and vice versa (shared RC customer keyed by the Django user PK).
 * API key: VITE_REVENUECAT_API_KEY (test_* for sandbox, live key for prod)
 */

// Type-only import: erased at build time, so this does NOT pull the SDK
// (170KB gz) into the entry bundle. The runtime SDK is loaded lazily via
// `rc()` below, inside the functions that actually need it — the SDK then
// only ships in its own chunk on /subscriptions or paywall interaction.
import type {
  Purchases,
  CustomerInfo,
  Offerings,
  Package,
} from "@revenuecat/purchases-js";

// ─── Constants (keep aligned with mobile `subscriptionRuntime.ts`) ──────────

export const RC_ENTITLEMENT_PRO = "Garzoni Pro";
export const RC_ENTITLEMENT_PLUS = "Garzoni Plus";

export const RC_OFFERING_PLUS = "plus_subscriptions";
export const RC_OFFERING_PRO = "pro_subscriptions";

/**
 * App Store product IDs for parity with native (`mobile/.../subscriptionRuntime.ts`).
 * RevenueCat references the same strings as App Store Connect—there are no separate “RC-only” store SKUs.
 */
export const APPLE_PRODUCT_IDS = {
  plus: {
    monthly: "app.garzoni.mobile.plus_monthly",
    yearly: "app.garzoni.mobile.plus_yearly",
  },
  pro: {
    monthly: "app.garzoni.mobile.pro_monthly",
    yearly: "app.garzoni.mobile.pro_yearly",
  },
} as const;

/**
 * Expected package identifiers in offerings (RevenueCat defaults).
 */
export const RC_PACKAGE_IDS = {
  monthly: "$rc_monthly",
  yearly: "$rc_annual",
  lifetime: "$rc_lifetime",
} as const;

// ─── Lazy SDK loader ──────────────────────────────────────────────────────────

/**
 * Dynamically import the RevenueCat Web SDK on first use, caching the module
 * so repeat calls don't re-fetch it. Keeps `@revenuecat/purchases-js` out of
 * the entry graph — it lands in its own `vendor-revenuecat` chunk, fetched
 * only when a paywall / subscriptions flow actually runs.
 */
let _rcModule: typeof import("@revenuecat/purchases-js") | null = null;
async function rc(): Promise<typeof import("@revenuecat/purchases-js")> {
  _rcModule ??= await import("@revenuecat/purchases-js");
  return _rcModule;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: Purchases | null = null;
let _configuredUserId: string | null = null;

/**
 * Returns true when the RC API key env-var is present.
 * Use this as a feature flag before calling any RC function.
 */
export function isRevenueCatEnabled(): boolean {
  return Boolean(import.meta.env.VITE_REVENUECAT_API_KEY?.trim());
}

/**
 * The web paywall opens RC Billing → Stripe Checkout. The appUserID we pass
 * becomes the RevenueCat customer the purchase is bound to, and the backend
 * webhook/sync only activates the matching Django user when that id is the
 * numeric user PK (see backend `views_revenuecat.py`, which silently ignores
 * non-digit ids). Passing a placeholder like "anonymous" therefore charges the
 * card but never grants the plan — guard against it everywhere.
 */
export function isValidAppUserId(
  appUserID: string | null | undefined
): boolean {
  return typeof appUserID === "string" && /^\d+$/.test(appUserID.trim());
}

/**
 * Configure (or re-configure) the RevenueCat SDK for a given user.
 * Safe to call on every login — it is a no-op when the user ID is unchanged.
 *
 * @param appUserID  Your backend user PK as a numeric string.
 * @throws when `appUserID` is not the numeric Django user PK — binding a
 *         purchase to a placeholder id loses the payment (see above).
 */
export async function configureRevenueCat(
  appUserID: string
): Promise<Purchases> {
  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "[RevenueCat] VITE_REVENUECAT_API_KEY is not set. " +
        "Add it to frontend/.env as VITE_REVENUECAT_API_KEY=<your_key>."
    );
  }

  if (!isValidAppUserId(appUserID)) {
    throw new Error(
      `[RevenueCat] Refusing to configure with invalid appUserID "${appUserID}". ` +
        "Expected the numeric Django user PK — a purchase bound to a placeholder " +
        "id is charged but never activates the user's plan."
    );
  }
  appUserID = appUserID.trim();

  // Re-use existing instance for the same user to avoid duplicate SDK inits.
  if (_instance && _configuredUserId === appUserID) {
    return _instance;
  }

  const { Purchases, LogLevel } = await rc();

  // In development, emit verbose SDK logs to the browser console.
  if (import.meta.env.DEV) {
    Purchases.setLogLevel(LogLevel.Debug);
  }

  _instance = Purchases.configure(apiKey, appUserID);
  _configuredUserId = appUserID;
  return _instance;
}

/** Reset the singleton (call on logout so the next user starts fresh). */
export function resetRevenueCat(): void {
  _instance = null;
  _configuredUserId = null;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function sdk(): Purchases {
  if (!_instance) {
    throw new Error(
      "[RevenueCat] SDK not initialized. Call configureRevenueCat(userId) first."
    );
  }
  return _instance;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch all available offerings from RevenueCat. */
export const rcGetOfferings = (): Promise<Offerings> => sdk().getOfferings();

export async function rcGetPackagesForOffering(
  offeringId: string
): Promise<Package[]> {
  const offerings = await sdk().getOfferings();
  // Prefer the explicit offering id; fall back to the project's current
  // offering (don't assume a tier maps to "current").
  const offering = offerings.all[offeringId] ?? offerings.current;
  return offering?.availablePackages ?? [];
}

/** Fetch the current customer info (entitlements, active subscriptions, …). */
export const rcGetCustomerInfo = (): Promise<CustomerInfo> =>
  sdk().getCustomerInfo();

/**
 * Purchase a RevenueCat package.
 * On web this opens Stripe Checkout (managed by RC Billing).
 *
 * @throws `PurchasesError` with a `userCancelledPurchase` code when the user
 *         dismisses the checkout page.
 */
export const rcPurchase = async (rcPackage: Package): Promise<CustomerInfo> => {
  const { customerInfo } = await sdk().purchase({ rcPackage });
  return customerInfo;
};

/**
 * Restore purchases for the current user.
 * Web SDK v1 has no `restorePurchases`; refreshing customer info re-syncs subscription state.
 */
export const rcRestorePurchases = async (): Promise<CustomerInfo> => {
  return sdk().getCustomerInfo();
};

export const rcIsProEntitled = (customerInfo: CustomerInfo): boolean =>
  RC_ENTITLEMENT_PRO in customerInfo.entitlements.active;

export const rcIsPlusEntitled = (customerInfo: CustomerInfo): boolean =>
  RC_ENTITLEMENT_PLUS in customerInfo.entitlements.active;

/** True when Plus or Pro entitlement is active. */
export const rcIsEntitled = (customerInfo: CustomerInfo): boolean =>
  rcIsProEntitled(customerInfo) || rcIsPlusEntitled(customerInfo);

export function rcGetActivePlan(
  customerInfo: CustomerInfo
): "pro" | "plus" | "starter" {
  if (rcIsProEntitled(customerInfo)) return "pro";
  if (rcIsPlusEntitled(customerInfo)) return "plus";
  return "starter";
}

/**
 * The store backing the active entitlement (e.g. "APP_STORE", "PLAY_STORE",
 * "STRIPE", "RC_BILLING"). Used to stop a user who already subscribed on one
 * platform from double-purchasing on another. Returns null when not entitled.
 */
export function rcGetEntitlementStore(
  customerInfo: CustomerInfo
): string | null {
  const active = customerInfo.entitlements.active;
  const ent = active[RC_ENTITLEMENT_PRO] ?? active[RC_ENTITLEMENT_PLUS];
  return (ent as { store?: string } | undefined)?.store ?? null;
}

/** True when the active subscription is managed outside this web storefront. */
export function rcIsManagedElsewhere(customerInfo: CustomerInfo): boolean {
  const store = rcGetEntitlementStore(customerInfo);
  return store === "APP_STORE" || store === "PLAY_STORE";
}

/** Human label for a RevenueCat store code. */
export function rcStoreLabel(store: string | null): string {
  switch (store) {
    case "APP_STORE":
      return "the App Store (iOS)";
    case "PLAY_STORE":
      return "Google Play (Android)";
    case "STRIPE":
    case "RC_BILLING":
      return "the web";
    default:
      return "another platform";
  }
}

/**
 * Open subscription management (Web SDK v1: use CustomerInfo.managementURL in a new tab).
 */
export const rcShowCustomerCenter = async (): Promise<void> => {
  const info = await sdk().getCustomerInfo();
  const url = info.managementURL;
  if (url && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  throw new Error(
    "[RevenueCat] No management URL available. The user may have no active subscription."
  );
};

// ─── Price formatting helper ───────────────────────────────────────────────────

/**
 * Format a RevenueCat Package price for display.
 * Falls back to the formatted string provided by RC, then to a manual format.
 */
export function formatRCPackagePrice(pkg: Package): string {
  try {
    // RC Web SDK exposes price on rcBillingProduct
    const product = (
      pkg as unknown as {
        rcBillingProduct?: {
          currentPrice?: {
            formatted?: string;
            amount?: number;
            amountMicros?: number;
            currency?: string;
          };
        };
      }
    ).rcBillingProduct;

    if (!product?.currentPrice) return "";

    const {
      formatted,
      amount,
      amountMicros,
      currency = "USD",
    } = product.currentPrice;

    if (formatted) return formatted;

    const value =
      amount !== undefined
        ? amount
        : amountMicros !== undefined
          ? amountMicros / 1_000_000
          : 0;

    return new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return "";
  }
}

/**
 * Return a human-readable period label for a package based on its type.
 * Falls back to the normalized period duration string from RC.
 */
export function rcPackagePeriodLabel(pkg: Package): string {
  const type = pkg.packageType as string;
  if (type === "MONTHLY" || type === "$rc_monthly") return "/ month";
  if (type === "ANNUAL" || type === "$rc_annual") return "/ year";
  if (type === "LIFETIME" || type === "$rc_lifetime") return "one-time";
  return "";
}
