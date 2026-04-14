import {
  PACKAGE_TYPE,
  type PurchasesPackage,
} from "react-native-purchases";

const PACKAGE_DISPLAY_ORDER: PACKAGE_TYPE[] = [
  PACKAGE_TYPE.ANNUAL,
  PACKAGE_TYPE.SIX_MONTH,
  PACKAGE_TYPE.THREE_MONTH,
  PACKAGE_TYPE.TWO_MONTH,
  PACKAGE_TYPE.MONTHLY,
  PACKAGE_TYPE.WEEKLY,
  PACKAGE_TYPE.LIFETIME,
  PACKAGE_TYPE.CUSTOM,
  PACKAGE_TYPE.UNKNOWN,
];

export function sortPackagesForPaywall(
  packages: PurchasesPackage[],
): PurchasesPackage[] {
  return [...packages].sort((a, b) => {
    const ia = PACKAGE_DISPLAY_ORDER.indexOf(a.packageType);
    const ib = PACKAGE_DISPLAY_ORDER.indexOf(b.packageType);
    if (ia !== ib) return ia - ib;
    return a.product.identifier.localeCompare(b.product.identifier);
  });
}

export function paywallPackageTypeI18nKey(
  packageType: PACKAGE_TYPE,
): string {
  switch (packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "subscriptions.paywallPackageAnnual";
    case PACKAGE_TYPE.MONTHLY:
      return "subscriptions.paywallPackageMonthly";
    case PACKAGE_TYPE.WEEKLY:
      return "subscriptions.paywallPackageWeekly";
    case PACKAGE_TYPE.LIFETIME:
      return "subscriptions.paywallPackageLifetime";
    case PACKAGE_TYPE.SIX_MONTH:
    case PACKAGE_TYPE.THREE_MONTH:
    case PACKAGE_TYPE.TWO_MONTH:
      return "subscriptions.paywallPackageMultiMonth";
    default:
      return "subscriptions.paywallPackageCustom";
  }
}

export function subscriptionPeriodI18nKey(
  iso: string | null | undefined,
): string | null {
  switch (iso) {
    case "P1W":
      return "subscriptions.paywallPeriodWeek";
    case "P1M":
      return "subscriptions.paywallPeriodMonth";
    case "P3M":
      return "subscriptions.paywallPeriodThreeMonths";
    case "P6M":
      return "subscriptions.paywallPeriodSixMonths";
    case "P1Y":
      return "subscriptions.paywallPeriodYear";
    default:
      return null;
  }
}

export function shouldMarkAnnualBestValue(
  packages: PurchasesPackage[],
  pkg: PurchasesPackage,
): boolean {
  if (pkg.packageType !== PACKAGE_TYPE.ANNUAL) return false;
  return packages.some((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
}
