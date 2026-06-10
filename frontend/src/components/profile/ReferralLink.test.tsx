import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReferralLink from "./ReferralLink";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";

vi.mock("@garzoni/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@garzoni/core")>();
  return {
    ...actual,
    fetchReferralSummary: vi.fn().mockResolvedValue({
      data: {
        referral_code: "TEST-CODE",
        referrals_made: [],
        referral_received: null,
        earned_discount_code: null,
      },
    }),
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>
  );
};

describe("ReferralLink", () => {
  const originalLocation = window.location;

  beforeAll(() => {
    // @ts-expect-error — deleting read-only location for test mock
    delete (window as Window & typeof globalThis).location;
    (window as Window & typeof globalThis).location = {
      ...originalLocation,
      origin: "https://app.garzoni.app",
    };
  });

  afterAll(() => {
    // @ts-expect-error — restoring original location after test mock
    window.location = originalLocation;
  });

  it("builds a welcome referral link with the referral code", () => {
    renderWithProviders(<ReferralLink referralCode="TEST-CODE" />);

    const input = screen.getByLabelText(/Referral link/i) as HTMLInputElement;
    expect(input.value).toBe("https://app.garzoni.app/welcome?ref=TEST-CODE");
  });

  it("copies the referral link to clipboard when clicking copy", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    renderWithProviders(<ReferralLink referralCode="FRIEND-123" />);

    const button = screen.getByRole("button", { name: /copy link/i });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith(
      "https://app.garzoni.app/welcome?ref=FRIEND-123"
    );
  });
});
