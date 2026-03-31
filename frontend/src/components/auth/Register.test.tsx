import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Register from "./Register";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";
import apiClient from "services/httpClient";

jest.mock("components/layout/Header", () => () => <div>Header</div>);

const mockRegisterUser = jest.fn();
jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({ registerUser: mockRegisterUser }),
}));
jest.mock("contexts/RecaptchaContext", () => ({
  useRecaptcha: () => ({ executeRecaptcha: null }),
}));
jest.mock("services/httpClient", () => ({
  __esModule: true,
  default: { get: jest.fn() },
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
    (globalThis as any).__TEST_LOCATION_SEARCH__ = "?ref=INVITE-XYZ";
    (globalThis as any).__TEST_LOCATION_PATHNAME__ = "/register";

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </I18nextProvider>
    );

    const input = screen.getByLabelText(/Referral Code/i) as HTMLInputElement;
    expect(input.value).toBe("INVITE-XYZ");

    delete (globalThis as any).__TEST_LOCATION_SEARCH__;
    delete (globalThis as any).__TEST_LOCATION_PATHNAME__;
  });

  it("blocks submit when referral code is invalid", async () => {
    mockApiGet.mockResolvedValue({ data: { valid: false } });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
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
      expect(mockRegisterUser).not.toHaveBeenCalled();
    });
  });
});
