import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";
import { ThemeProvider } from "contexts/ThemeContext";
import Welcome from "./Welcome";

vi.mock("components/layout/Header", () => ({
  default: () => <div>Header</div>,
}));
vi.mock("./HeroSection", () => ({ default: () => <div>Hero</div> }));
vi.mock("./FeatureSection", () => ({ default: () => <div>Features</div> }));
vi.mock("./ReviewsSection", () => ({ default: () => <div>Reviews</div> }));
vi.mock("./CTASection", () => ({ default: () => <div>CTA</div> }));

const renderWelcome = (initialPath: string) =>
  render(
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
  );

describe("Welcome referral flow", () => {
  it("shows referral modal when ref query param is present", () => {
    renderWelcome("/welcome?ref=INVITE-123");

    expect(
      screen.getByText(/You were invited to Garzoni/i)
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
