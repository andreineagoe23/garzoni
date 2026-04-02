/**
 * Clicks real WeakSkills + WeakSkillsQuickCard wired like Dashboard.
 * Real router via __USE_REAL_ROUTER__ (see test-utils/react-router-dom-mock-impl.js).
 */
import React from "react";
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../i18n";
import WeakSkills from "./WeakSkills";
import WeakSkillsQuickCard from "./WeakSkillsQuickCard";
import { useDashboardSkillExercisesNavigation } from "hooks/useDashboardSkillExercisesNavigation";

const mockTrackEvent = jest.fn();

function assertSkillQuery(loc: { pathname: string; search: string }) {
  expect(loc.pathname).toBe("/exercises");
  expect(new URLSearchParams(loc.search).get("skill")).toBe("Credit Score");
}

describe("Dashboard weak-skill UI navigation contract", () => {
  beforeAll(() => {
    if (!window.matchMedia) {
      window.matchMedia = () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }) as unknown as MediaQueryList;
    }
  });

  beforeEach(() => {
    (globalThis as { __USE_REAL_ROUTER__?: boolean }).__USE_REAL_ROUTER__ =
      true;
    mockTrackEvent.mockClear();
  });

  afterEach(() => {
    delete (globalThis as { __USE_REAL_ROUTER__?: boolean })
      .__USE_REAL_ROUTER__;
  });

  it("WeakSkills card opens exercises with ?skill=", async () => {
    function OnlyWeakSkills() {
      const navigate = useNavigate();
      const { handleWeakSkillClick } = useDashboardSkillExercisesNavigation(
        navigate,
        mockTrackEvent
      );
      const skill = { skill: "Credit Score", proficiency: 25 };
      return (
        <WeakSkills
          show
          weakestSkills={[skill]}
          hasAnyMasteryData
          onSkillClick={handleWeakSkillClick}
        />
      );
    }

    const router = createMemoryRouter(
      [
        { path: "/", element: <OnlyWeakSkills /> },
        { path: "/exercises", element: <div data-testid="ex">ex</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /Practice Credit Score skill/i })
    );

    assertSkillQuery(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weak_skill_click",
      expect.objectContaining({ skill: "Credit Score" })
    );
  });

  it("WeakSkills practice control uses the same contract", async () => {
    function OnlyWeakSkillsPractice() {
      const navigate = useNavigate();
      const { handleWeakSkillPractice } = useDashboardSkillExercisesNavigation(
        navigate,
        mockTrackEvent
      );
      const skill = { skill: "Credit Score", proficiency: 25 };
      return (
        <WeakSkills
          show
          weakestSkills={[skill]}
          hasAnyMasteryData
          onPracticeClick={handleWeakSkillPractice}
        />
      );
    }

    const router = createMemoryRouter(
      [
        { path: "/", element: <OnlyWeakSkillsPractice /> },
        { path: "/exercises", element: <div>ex</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Practice Credit Score to improve this recommendation/i,
      })
    );

    assertSkillQuery(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "improve_recommendation_click",
      expect.objectContaining({ skill: "Credit Score" })
    );
  });

  it("WeakSkillsQuickCard CTA uses quick_card_exercises contract", async () => {
    function OnlyQuickCard() {
      const navigate = useNavigate();
      const { handleQuickCardSkillExercises } =
        useDashboardSkillExercisesNavigation(navigate, mockTrackEvent);
      const skill = { skill: "Credit Score", proficiency: 25 };
      return (
        <WeakSkillsQuickCard
          topSkill={skill}
          onRecommendedSkillExercises={handleQuickCardSkillExercises}
          onOpenExercises={() => navigate("/exercises")}
        />
      );
    }

    const router = createMemoryRouter(
      [
        { path: "/", element: <OnlyQuickCard /> },
        { path: "/exercises", element: <div>ex</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Credit Score/i }));

    assertSkillQuery(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "quick_card_exercises_click",
      expect.objectContaining({ skill: "Credit Score" })
    );
  });
});
