import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Welcome from "./Welcome";
import { MemoryRouter } from "react-router-dom";
import RouterMock from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";

jest.mock("components/layout/Header", () => () => <div>Header</div>);
jest.mock("./HeroSection", () => () => <div>Hero</div>);
jest.mock("./FeatureSection", () => () => <div>Features</div>);
jest.mock("./ReviewsSection", () => () => <div>Reviews</div>);
jest.mock("./CTASection", () => () => <div>CTA</div>);

const renderWithRoute = (initialEntries: string[]) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <Welcome />
      </MemoryRouter>
    </I18nextProvider>
  );

describe("Welcome referral flow", () => {
  it("shows referral modal when ref query param is present", () => {
    (globalThis as any).__TEST_LOCATION_SEARCH__ = "?ref=INVITE-123";
    (globalThis as any).__TEST_LOCATION_PATHNAME__ = "/welcome";

    renderWithRoute(["/welcome"]);

    expect(
      screen.getByText(/You were invited to Monevo/i)
    ).toBeInTheDocument();

    delete (globalThis as any).__TEST_LOCATION_SEARCH__;
    delete (globalThis as any).__TEST_LOCATION_PATHNAME__;
  });

  it("navigates to register with ref when clicking start with invite", () => {
    (globalThis as any).__TEST_LOCATION_SEARCH__ = "?ref=INVITE-123";
    (globalThis as any).__TEST_LOCATION_PATHNAME__ = "/welcome";

    renderWithRoute(["/welcome"]);

    const button = screen.getByRole("button", {
      name: /Start with your invite/i,
    });
    fireEvent.click(button);

    const { mockNavigate } = RouterMock as any;
    expect(mockNavigate).toHaveBeenCalledWith("/register?ref=INVITE-123");

    delete (globalThis as any).__TEST_LOCATION_SEARCH__;
    delete (globalThis as any).__TEST_LOCATION_PATHNAME__;
  });
});
