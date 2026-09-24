import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";
import { ThemeProvider } from "contexts/ThemeContext";
import Welcome from "./Welcome";

// The page reads the plan catalog and the live stats on mount; resolve both
// deterministically instead of hitting the network.
vi.mock("@garzoni/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@garzoni/core")>();
  return {
    ...actual,
    fetchSubscriptionPlans: vi.fn().mockResolvedValue({
      data: {
        plans: [
          {
            plan_id: "plus",
            billing_interval: "monthly",
            price_amount: "6.99",
            currency: "GBP",
          },
          {
            plan_id: "plus",
            billing_interval: "yearly",
            price_amount: "59.99",
            currency: "GBP",
          },
          {
            plan_id: "pro",
            billing_interval: "monthly",
            price_amount: "7.99",
            currency: "GBP",
          },
          {
            plan_id: "pro",
            billing_interval: "yearly",
            price_amount: "69.99",
            currency: "GBP",
          },
        ],
        promo: null,
      },
    }),
    fetchPublicStats: vi.fn().mockResolvedValue({
      data: {
        learners: 106,
        on_streak: 7,
        app_store_rating: { average: 5, count: 4 },
      },
    }),
  };
});

const renderWelcome = (initialPath: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route
                path="/register"
                element={<div data-testid="register-page">Register</div>}
              />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

describe("Welcome referral flow", () => {
  it("shows referral modal when ref query param is present", async () => {
    renderWelcome("/welcome?ref=INVITE-123");

    expect(
      await screen.findByText(/You were invited to Garzoni/i)
    ).toBeInTheDocument();
  });

  it("navigates to register with ref when clicking start with invite", () => {
    renderWelcome("/welcome?ref=INVITE-123");

    const button = screen.getByRole("button", {
      name: /Start with your invite/i,
    });
    fireEvent.click(button);

    expect(screen.getByTestId("register-page")).toBeInTheDocument();
  });
});

describe("Welcome page", () => {
  it("shows the live stats rather than static copy", async () => {
    renderWelcome("/welcome");

    expect(await screen.findByText("106")).toBeInTheDocument();
    expect(screen.getByText("learners")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("on a streak right now")).toBeInTheDocument();
    expect(screen.getByText("App Store rating")).toBeInTheDocument();
  });

  it("describes the free plan as the Basic Finance course", () => {
    renderWelcome("/welcome");

    expect(screen.getByText("The Basic Finance course")).toBeInTheDocument();
  });

  it("switches the paid plans between annual and monthly prices", async () => {
    renderWelcome("/welcome");

    expect(
      await screen.findByText("Billed £59.99 a year · save 28%")
    ).toBeInTheDocument();
    expect(screen.getByText("£5.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    expect(screen.getByText("£6.99")).toBeInTheDocument();
    expect(screen.getByText("£7.99")).toBeInTheDocument();
  });

  it("marks the correct quiz answer after checking", () => {
    renderWelcome("/welcome");
    const quiz = screen
      .getByText(/how much do you save/i)
      .closest(".gzh-screen") as HTMLElement;

    fireEvent.click(within(quiz).getByRole("button", { name: /£400/ }));
    fireEvent.click(within(quiz).getByRole("button", { name: "CHECK" }));

    expect(within(quiz).getByText("Nice one!")).toBeInTheDocument();
    expect(within(quiz).getByRole("button", { name: /£400/ })).toHaveAttribute(
      "data-state",
      "correct"
    );
  });
});
