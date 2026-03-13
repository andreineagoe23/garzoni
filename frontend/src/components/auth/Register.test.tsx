import React from "react";
import { render, screen } from "@testing-library/react";
import Register from "./Register";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";

jest.mock("components/layout/Header", () => () => <div>Header</div>);
jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({ registerUser: jest.fn() }),
}));
jest.mock("contexts/RecaptchaContext", () => ({
  useRecaptcha: () => ({ executeRecaptcha: null }),
}));

describe("Register with referral", () => {
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
});
