/**
 * RevenueCat Web SDK service for Monevo.
 *
 * Wraps @revenuecat/purchases-js with a singleton pattern so the SDK is
 * configured once per user session and reused across all billing components.
 *
 * Entitlement:  "Monevo Educational Pro"
 * Products:     monthly · yearly · lifetime  (configured in RC Dashboard)
 * API key:      VITE_REVENUECAT_API_KEY (test_* for sandbox, live key for prod)
 */

import {
  Purchases,
  type CustomerInfo,
  type Offerings,
  type Package,
  LogLevel,
} from "@revenuecat/purchases-js";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Entitlement identifier as configured in the RevenueCat Dashboard. */
export const RC_ENTITLEMENT = "Monevo Educational Pro";

/**
 * Expected offering identifiers in the RevenueCat Dashboard.
 * The default offering is "default"; products inside it should have these
 * package identifiers (or use RC's built-in $rc_monthly, $rc_annual, $rc_lifetime).
 */
export const RC_PACKAGE_IDS = {
  monthly: "$rc_monthly",
  yearly: "$rc_annual",
  lifetime: "$rc_lifetime",
} as const;

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
 * Configure (or re-configure) the RevenueCat SDK for a given user.
 * Safe to call on every login — it is a no-op when the user ID is unchanged.
 *
 * @param appUserID  Your backend user PK (or any stable unique string).
 */
export function configureRevenueCat(appUserID: string): Purchases {
  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "[RevenueCat] VITE_REVENUECAT_API_KEY is not set. " +
        "Add it to frontend/.env as VITE_REVENUECAT_API_KEY=<your_key>."
    );
  }

  // Re-use existing instance for the same user to avoid duplicate SDK inits.
  if (_instance && _configuredUserId === appUserID) {
    return _instance;
  }

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
export const rcGetOfferings = (): Promise<Offerings> =>
  sdk().getOfferings();

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

/**
 * Returns true when the customer holds an active "Monevo Educational Pro"
 * entitlement.
 */
export const rcIsEntitled = (customerInfo: CustomerInfo): boolean =>
  RC_ENTITLEMENT in customerInfo.entitlements.active;

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
    const product = (pkg as unknown as {
      rcBillingProduct?: {
        currentPrice?: {
          formatted?: string;
          amount?: number;
          amountMicros?: number;
          currency?: string;
        };
      };
    }).rcBillingProduct;

    if (!product?.currentPrice) return "";

    const { formatted, amount, amountMicros, currency = "USD" } =
      product.currentPrice;

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
