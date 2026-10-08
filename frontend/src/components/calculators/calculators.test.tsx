import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../test-utils/i18n-for-tests";
import SavingsGoalPage from "./SavingsGoalPage";
import BudgetRulePage from "./BudgetRulePage";

const renderAt = (path: string, page: React.ReactElement) =>
  render(
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
      </I18nextProvider>
    </HelmetProvider>
  );

describe("SavingsGoalPage", () => {
  it("shows the monthly amount for the default goal, rounded up", () => {
    renderAt("/calculators/savings-goal", <SavingsGoalPage />);

    expect(
      screen.getByRole("heading", { name: "To reach £5,000 in 2 years" })
    ).toBeInTheDocument();
    // £4,500 to find over 24 months at 4%: £178.75, rounded up.
    expect(screen.getByText("£179")).toBeInTheDocument();
  });

  it("switches to how long a monthly amount takes", () => {
    renderAt("/calculators/savings-goal", <SavingsGoalPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "How long it will take" })
    );

    expect(
      screen.getByRole("heading", { name: "Saving £200 a month" })
    ).toBeInTheDocument();
    expect(screen.getByText("1 year and 10 months")).toBeInTheDocument();
  });

  it("says when the goal is already covered", () => {
    renderAt("/calculators/savings-goal", <SavingsGoalPage />);

    fireEvent.change(screen.getByLabelText("Already saved (£)"), {
      target: { value: "6000" },
    });

    expect(
      screen.getByText(/already saved enough for this goal/)
    ).toBeInTheDocument();
  });
});

describe("BudgetRulePage", () => {
  it("splits take-home pay and rebuilds it around real essentials", () => {
    renderAt("/calculators/50-30-20-budget", <BudgetRulePage />);

    expect(screen.getByText("£1,100")).toBeInTheDocument();
    expect(screen.getByText("£660")).toBeInTheDocument();
    // £1,200 of essentials on £2,200: wants take the £100 overspend.
    expect(
      screen.getByText(/Your essentials take 55% of your pay/)
    ).toBeInTheDocument();
    expect(screen.getByText("£560")).toBeInTheDocument();
  });

  it("shows only the plain split when essentials are left blank", () => {
    renderAt("/calculators/50-30-20-budget", <BudgetRulePage />);

    fireEvent.change(
      screen.getByLabelText("What your essentials cost now (£, optional)"),
      { target: { value: "" } }
    );

    expect(
      screen.queryByText("Built around your real essentials")
    ).not.toBeInTheDocument();
    expect(screen.getByText("£440")).toBeInTheDocument();
  });
});
