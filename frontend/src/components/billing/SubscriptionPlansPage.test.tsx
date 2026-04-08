import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { vi } from "vitest";
import { formatCurrency, getLocale } from "utils/format";

import SubscriptionPlansPage from "./SubscriptionPlansPage";

vi.mock("services/analyticsService", () => ({
  recordFunnelEvent: vi.fn(),
}));

vi.mock("axios", () => {
  const get = vi.fn();
  const post = vi.fn();
  const mock = {
    get,
    post,
    create: () => mock,
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return { __esModule: true, default: mock };
});
const mockNavigate = vi.fn();
const axiosMock = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

let mockQuestionnaireStatus: "in_progress" | "completed" = "in_progress";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: "" }),
  };
});

vi.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    entitlements: { plan: "starter", status: "inactive", trialEnd: null },
    entitlementError: null,
    entitlementSupportLink: null,
    reloadEntitlements: () => undefined,
    loadProfile: async () => ({
      user_data: { has_paid: false, is_questionnaire_completed: false },
    }),
    isAuthenticated: true,
    getAccessToken: () => "token",
  }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      if (opts?.queryKey?.[0] === "questionnaire-progress") {
        return {
          data: { status: mockQuestionnaireStatus },
          isLoading: false,
          isFetching: false,
          isFetched: true,
        };
      }
      return actual.useQuery(opts);
    },
  };
});

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
      billing_interval: "yearly",
      stripe_price_id: "price_plus_yearly",
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
      billing_interval: "yearly",
      stripe_price_id: "price_pro_yearly",
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

describe("SubscriptionPlansPage", () => {
  beforeEach(async () => {
    axiosMock.get.mockResolvedValue({ data: plansResponse });
    Object.defineProperty(window, "location", {
      value: { assign: vi.fn() },
      writable: true,
    });
    mockNavigate.mockClear();
  });

  it("renders plan details from /plans", async () => {
    render(
      <MemoryRouter initialEntries={["/subscriptions"]}>
        <SubscriptionPlansPage />
      </MemoryRouter>
    );

    const plusLabel = "Plus";
    const choosePlus = "Choose Plus";
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
    expect(
      screen.getByRole("button", { name: choosePlus })
    ).toBeInTheDocument();
  });

  it("navigates to onboarding when questionnaire incomplete and user clicks Plus", async () => {
    mockQuestionnaireStatus = "in_progress";
    render(
      <MemoryRouter initialEntries={["/subscriptions"]}>
        <SubscriptionPlansPage />
      </MemoryRouter>
    );

    const choosePlus = "Choose Plus";
    const button = await screen.findByRole("button", { name: choosePlus });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("navigates to all-topics when questionnaire complete and user clicks Starter (Free)", async () => {
    mockQuestionnaireStatus = "completed";
    render(
      <MemoryRouter initialEntries={["/subscriptions"]}>
        <SubscriptionPlansPage />
      </MemoryRouter>
    );

    // Matches subscriptions.startStarter (en: "Start free")
    const starterButton = await screen.findByRole("button", {
      name: "Start free",
    });
    fireEvent.click(starterButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/all-topics");
    });
    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});
