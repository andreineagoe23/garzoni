import { NativeModules, Platform } from "react-native";

type PurchasesModule = typeof import("react-native-purchases").default;
type PurchasesErrorCodes = typeof import("react-native-purchases").PURCHASES_ERROR_CODE;

export type RevenueCatPurchasesApi = {
  Purchases: PurchasesModule;
  PURCHASES_ERROR_CODE: PurchasesErrorCodes;
};

let cached: RevenueCatPurchasesApi | null | undefined;

/**
 * The RevenueCat JS SDK creates NativeEventEmitter(RNPurchases) at require time.
 * If the native module is absent (Expo Go, or an outdated native build), a static
 * import crashes the whole bundle before route default exports are defined.
 */
export function getRevenueCatPurchases(): RevenueCatPurchasesApi | null {
  if (cached !== undefined) return cached;

  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    cached = null;
    return null;
  }

  if (!NativeModules.RNPurchases) {
    cached = null;
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("react-native-purchases") as typeof import("react-native-purchases");
  cached = {
    Purchases: mod.default,
    PURCHASES_ERROR_CODE: mod.PURCHASES_ERROR_CODE,
  };
  return cached;
}
