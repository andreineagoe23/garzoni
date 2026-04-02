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
vi.mock("services/httpClient", () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));

const mockApiGet = apiClient.get as unknown as {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
};

describe("Register with referral", () => {
  beforeEach(() => {
    mockRegisterUser.mockReset();
    mockRegisterUser.mockResolvedValue({ success: true });
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({ data: { valid: true } });
  });

  it("prefills referral code from ref query param", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/register?ref=INVITE-XYZ"]}>
          <Register />
        </MemoryRouter>
      </I18nextProvider>
    );

    const input = screen.getByLabelText(/Referral Code/i) as HTMLInputElement;
    expect(input.value).toBe("INVITE-XYZ");
  });

  it("blocks submit when referral code is invalid", async () => {
    mockApiGet.mockResolvedValue({ data: { valid: false } });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/register"]}>
          <Register />
        </MemoryRouter>
      </I18nextProvider>
    );

    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/^Username$/i), {
      target: { value: "john-doe" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "unit-test-password!" },
    });
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
});
