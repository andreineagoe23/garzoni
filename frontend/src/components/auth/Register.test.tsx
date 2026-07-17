import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Register from "./Register";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";
import apiClient from "services/httpClient";
import { vi } from "vitest";

vi.mock("components/layout/Header", () => ({
  default: () => <div>Header</div>,
}));

const mockRegisterUser = vi.fn();
vi.mock("contexts/AuthContext", () => ({
  useAuth: () => ({ registerUser: mockRegisterUser }),
}));
vi.mock("contexts/RecaptchaContext", () => ({
  useRecaptcha: () => ({ executeRecaptcha: null }),
}));
vi.mock("contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true, toggleDarkMode: vi.fn() }),
}));
vi.mock("services/httpClient", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}));
const mockRecordFunnelEvent = vi.fn(() => Promise.resolve());
vi.mock("services/analyticsService", () => ({
  recordFunnelEvent: (...args: unknown[]) => mockRecordFunnelEvent(...args),
}));

const mockApiGet = apiClient.get as unknown as {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
};

const renderRegister = (initialEntry = "/register") =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Register />
      </MemoryRouter>
    </I18nextProvider>
  );

/** Fill step 1 (email + password + required consents) and continue to step 2. */
const completeStepOne = () => {
  fireEvent.change(screen.getByLabelText(/^Email$/i), {
    target: { value: "john@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^Password$/i), {
    target: { value: "unit-test-password!" },
  });
  fireEvent.click(document.getElementById("accept_terms") as HTMLInputElement);
  fireEvent.click(document.getElementById("age_confirmed") as HTMLInputElement);
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
};

describe("Register (two-step)", () => {
  beforeEach(() => {
    mockRegisterUser.mockReset();
    mockRegisterUser.mockResolvedValue({ success: true });
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({ data: { valid: true } });
    mockRecordFunnelEvent.mockClear();
  });

  it("starts on step 1 without name/referral/username fields", () => {
    renderRegister();

    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/First Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Referral Code/i)).not.toBeInTheDocument();
    // No username field anywhere in the flow — backend auto-generates it.
    expect(screen.queryByLabelText(/Username/i)).not.toBeInTheDocument();
  });

  it("advances to step 2 after consents and shows optional fields", () => {
    renderRegister();
    completeStepOne();

    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    // Referral input is behind the collapsed invite-code disclosure.
    expect(screen.queryByLabelText(/Referral Code/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Have an invite code\?/i })
    );
    expect(screen.getByLabelText(/Referral Code/i)).toBeInTheDocument();
  });

  it("prefills referral code from ref query param (disclosure auto-open)", () => {
    renderRegister("/register?ref=INVITE-XYZ");
    completeStepOne();

    const input = screen.getByLabelText(/Referral Code/i) as HTMLInputElement;
    expect(input.value).toBe("INVITE-XYZ");
  });

  it("blocks submit when referral code is invalid", async () => {
    mockApiGet.mockResolvedValue({ data: { valid: false } });
    renderRegister();
    completeStepOne();

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Have an invite code\?/i })
    );
    fireEvent.change(screen.getByLabelText(/Referral Code/i), {
      target: { value: "BAD-CODE" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/referrals/validate/", {
        params: { code: "BAD-CODE" },
        skipAuthRedirect: true,
      });
    });
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("submits only provided fields and never a username", async () => {
    renderRegister();
    completeStepOne();

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "John" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

    await waitFor(() => expect(mockRegisterUser).toHaveBeenCalledTimes(1));
    const payload = mockRegisterUser.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload.email).toBe("john@example.com");
    expect(payload.password).toBe("unit-test-password!");
    expect(payload.accept_terms).toBe(true);
    expect(payload.age_confirmed).toBe(true);
    expect(payload.first_name).toBe("John");
    expect(payload).not.toHaveProperty("username");
    expect(payload).not.toHaveProperty("last_name");
    expect(payload).not.toHaveProperty("referral_code");
  });

  it("Skip on step 2 creates the account with step-1 data only", async () => {
    renderRegister("/register?ref=INVITE-XYZ");
    completeStepOne();

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "Ignored" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/i }));

    await waitFor(() => expect(mockRegisterUser).toHaveBeenCalledTimes(1));
    const payload = mockRegisterUser.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("username");
    expect(payload).not.toHaveProperty("first_name");
    expect(payload).not.toHaveProperty("referral_code");
    expect(payload.accept_terms).toBe(true);
    expect(payload.age_confirmed).toBe(true);
  });

  it("Google button is tap-to-consent: enabled without checking any boxes", () => {
    renderRegister();

    const googleLink = screen.getByRole("link", { name: /Google/i });
    expect(googleLink).not.toHaveAttribute("aria-disabled");
    expect(googleLink.className).not.toContain("pointer-events-none");
    // Consent travels in the OAuth state payload (mobile parity).
    const href = googleLink.getAttribute("href") || "";
    const state = new URL(href).searchParams.get("state") || "";
    const decoded = JSON.parse(
      atob(state.replace(/^v1\./, "").replace(/-/g, "+").replace(/_/g, "/"))
    );
    expect(decoded.accept_terms).toBe(true);
    expect(decoded.age_confirmed).toBe(true);
    // Caption under the button states the consent contract.
    expect(
      screen.getByText(/By continuing you agree to our/i)
    ).toBeInTheDocument();
  });

  it("emits register step funnel events", () => {
    renderRegister();
    expect(mockRecordFunnelEvent).toHaveBeenCalledWith(
      "register_step_view",
      expect.objectContaining({
        metadata: expect.objectContaining({ step: 1 }),
      })
    );

    completeStepOne();
    expect(mockRecordFunnelEvent).toHaveBeenCalledWith(
      "register_step_continue",
      expect.objectContaining({
        metadata: expect.objectContaining({ step: 1 }),
      })
    );
    expect(mockRecordFunnelEvent).toHaveBeenCalledWith(
      "register_step_view",
      expect.objectContaining({
        metadata: expect.objectContaining({ step: 2 }),
      })
    );
  });
});
