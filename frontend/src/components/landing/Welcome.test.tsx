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

// Welcome fetches the public pricing catalog on mount; mock it so that fetch
// resolves deterministically instead of hitting the real network in tests.
vi.mock("services/httpClient", () => ({
  __esModule: true,
  default: {
    get: vi.fn().mockResolvedValue({ data: { plans: [], promo: null } }),
  },
}));

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
