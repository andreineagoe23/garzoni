// Mock all native / network dependencies before importing the module under test.
jest.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("@garzoni/core", () => ({
  fetchEntitlements: jest.fn(),
  postRevenueCatSync: jest.fn(),
  postSubscriptionSync: jest.fn(),
  queryKeys: { entitlements: () => ["entitlements"] },
}));
jest.mock("../safeRevenueCat", () => ({ getRevenueCatPurchases: jest.fn() }), {
  virtual: true,
});
jest.mock("../../billing/safeRevenueCat", () => ({
  getRevenueCatPurchases: jest.fn(),
}));
jest.mock("react-native-purchases", () => ({}));
jest.mock("@tanstack/react-query", () => ({}));

import {
  rcIsEntitled,
  rcIsProEntitled,
  rcIsPlusEntitled,
  rcGetActivePlan,
  RC_ENTITLEMENT_PRO,
  RC_ENTITLEMENT_PLUS,
  PRODUCT_TO_PLAN,
} from "../../billing/subscriptionRuntime";

function makeCustomerInfo(
  activeEntitlements: string[] = [],
  activeSubscriptions: string[] = [],
) {
  const entitlements: Record<string, unknown> = {};
  for (const key of activeEntitlements) entitlements[key] = { isActive: true };
  return {
    entitlements: { active: entitlements },
    activeSubscriptions,
  } as never;
}

describe("rcIsProEntitled / rcIsPlusEntitled / rcIsEntitled", () => {
  it("returns false with no entitlements", () => {
    const ci = makeCustomerInfo();
    expect(rcIsProEntitled(ci)).toBe(false);
    expect(rcIsPlusEntitled(ci)).toBe(false);
    expect(rcIsEntitled(ci)).toBe(false);
  });

  it("detects Pro entitlement", () => {
    const ci = makeCustomerInfo([RC_ENTITLEMENT_PRO]);
    expect(rcIsProEntitled(ci)).toBe(true);
    expect(rcIsEntitled(ci)).toBe(true);
  });

  it("detects Plus entitlement without Pro", () => {
    const ci = makeCustomerInfo([RC_ENTITLEMENT_PLUS]);
    expect(rcIsPlusEntitled(ci)).toBe(true);
    expect(rcIsProEntitled(ci)).toBe(false);
    expect(rcIsEntitled(ci)).toBe(true);
  });
});

describe("rcGetActivePlan", () => {
  it('returns "starter" with no entitlements or subscriptions', () => {
    expect(rcGetActivePlan(makeCustomerInfo())).toBe("starter");
  });

  it('returns "pro" when Pro entitlement active', () => {
    expect(rcGetActivePlan(makeCustomerInfo([RC_ENTITLEMENT_PRO]))).toBe("pro");
  });

  it('returns "plus" when only Plus entitlement active', () => {
    expect(rcGetActivePlan(makeCustomerInfo([RC_ENTITLEMENT_PLUS]))).toBe(
      "plus",
    );
  });

  it('returns "pro" from active subscription product ID (fallback)', () => {
    const proId = Object.entries(PRODUCT_TO_PLAN).find(
      ([, p]) => p === "pro",
    )?.[0];
    if (!proId) return;
    expect(rcGetActivePlan(makeCustomerInfo([], [proId]))).toBe("pro");
  });

  it('returns "plus" from active subscription product ID (fallback)', () => {
    const plusId = Object.entries(PRODUCT_TO_PLAN).find(
      ([, p]) => p === "plus",
    )?.[0];
    if (!plusId) return;
    expect(rcGetActivePlan(makeCustomerInfo([], [plusId]))).toBe("plus");
  });
});

describe("PRODUCT_TO_PLAN mapping", () => {
  it("maps Pro product IDs to pro", () => {
    const proIds = Object.entries(PRODUCT_TO_PLAN).filter(
      ([, v]) => v === "pro",
    );
    expect(proIds.length).toBeGreaterThan(0);
  });

  it("maps Plus product IDs to plus", () => {
    const plusIds = Object.entries(PRODUCT_TO_PLAN).filter(
      ([, v]) => v === "plus",
    );
    expect(plusIds.length).toBeGreaterThan(0);
  });

  it("includes v3 product IDs", () => {
    expect(Object.keys(PRODUCT_TO_PLAN).some((k) => k.includes("v3"))).toBe(
      true,
    );
  });
});
