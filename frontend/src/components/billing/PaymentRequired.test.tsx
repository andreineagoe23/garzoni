import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import i18n from "i18n";
import { formatCurrency, getLocale } from "utils/format";

jest.mock("services/analyticsService", () => ({
  recordFunnelEvent: jest.fn(),
}));

jest.mock("axios");
const mockNavigate = jest.fn();
const axiosMock = axios as jest.Mocked<typeof axios>;

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: "" }),
  };
});

jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    entitlements: { plan: "free", status: "inactive", trialEnd: null },
    entitlementError: null,
    entitlementSupportLink: null,
    reloadEntitlements: jest.fn(),
    loadProfile: jest.fn().mockResolvedValue({
      user_data: { has_paid: false, is_questionnaire_completed: false },
    }),
    isAuthenticated: true,
  }),
}));

import PaymentRequired from "./PaymentRequired";

const plansResponse = {
  plans: [
    {
      plan_id: "starter",
      name: "Starter",
      billing_interval: "monthly",
      stripe_price_id: "price_starter",
      price_amount: 0,
      currency: "USD",
      trial_days: 0,
      features: {
        daily_limits: {
          name: "Daily lessons",
          enabled: true,
          daily_quota: 3,
          description: "3 core learning actions per day",
        },
      },
    },
    {
      plan_id: "plus",
      name: "Plus",
      billing_interval: "monthly",
      stripe_price_id: "price_plus",
      price_amount: 12,
      currency: "USD",
      trial_days: 7,
      features: {
        ai_tutor: {
          name: "AI tutor",
          enabled: true,
          daily_quota: 50,
          description: "50 AI tutor prompts per day",
        },
      },
    },
    {
      plan_id: "pro",
      name: "Pro",
      billing_interval: "monthly",
      stripe_price_id: "price_pro",
      price_amount: 24,
      currency: "USD",
      trial_days: 7,
      features: {
        ai_tutor: {
          name: "AI tutor",
          enabled: true,
          daily_quota: 200,
          description: "200 AI tutor prompts per day",
        },
      },
    },
  ],
};

describe("PaymentRequired", () => {
  beforeEach(async () => {
    axiosMock.get.mockResolvedValue({ data: plansResponse });
    await i18n.changeLanguage("en");
    Object.defineProperty(window, "location", {
      value: { assign: jest.fn() },
      writable: true,
    });
    mockNavigate.mockClear();
  });

  it("renders plan details from /plans", async () => {
    render(
      <MemoryRouter initialEntries={["/subscriptions"]}>
        <PaymentRequired />
      </MemoryRouter>
    );

    const plusLabel = i18n.t("plans.plus", { ns: "billing" });
    const choosePlus = i18n.t("paymentRequired.choosePlan", {
      ns: "billing",
      plan: plusLabel,
    });
    const priceLabel = formatCurrency(12, "USD", getLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const plusLabels = await screen.findAllByText(plusLabel);
    expect(plusLabels.length).toBeGreaterThan(0);
    expect(screen.getByText(priceLabel)).toBeInTheDocument();
    const aiDescription =
      plansResponse.plans[1]?.features?.ai_tutor?.description || "";
    expect(
      screen.getByText((content) => content.includes(aiDescription))
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: choosePlus })).toBeInTheDocument();
  });

  it("navigates to questionnaire with selected plan", async () => {
    render(
      <MemoryRouter initialEntries={["/subscriptions"]}>
        <PaymentRequired />
      </MemoryRouter>
    );

    const plusLabel = i18n.t("plans.plus", { ns: "billing" });
    const choosePlus = i18n.t("paymentRequired.choosePlan", {
      ns: "billing",
      plan: plusLabel,
    });
    const button = await screen.findByRole("button", { name: choosePlus });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/questionnaire?plan_id=plus&billing_interval=monthly"
      );
    });
  });
});
