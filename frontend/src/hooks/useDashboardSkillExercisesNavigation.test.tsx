/**
 * Real router hooks via createMemoryRouter / RouterProvider.
 */
import React from "react";
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useDashboardSkillExercisesNavigation } from "./useDashboardSkillExercisesNavigation";

const mockTrackEvent = vi.fn();

function NavigationHarness() {
  const navigate = useNavigate();
  const {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  } = useDashboardSkillExercisesNavigation(navigate, mockTrackEvent);

  const skill = { skill: "Emergency Fund", proficiency: 18 };

  return (
    <div>
      <button type="button" onClick={() => handleWeakSkillClick(skill)}>
        weak-card
      </button>
      <button type="button" onClick={() => handleWeakSkillPractice(skill)}>
        practice
      </button>
      <button
        type="button"
        onClick={() => handleQuickCardSkillExercises(skill)}
      >
        quick-card
      </button>
    </div>
  );
}

function assertNavigationContract(loc: { pathname: string; search: string }) {
  expect(loc.pathname).toBe("/exercises");
  const params = new URLSearchParams(loc.search);
  expect(params.get("skill")).toBe("Emergency Fund");
}

describe("useDashboardSkillExercisesNavigation", () => {
  beforeEach(() => {
    mockTrackEvent.mockReset();
  });

  it("navigates with shared contract for weak skill card click", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <NavigationHarness /> },
        { path: "/exercises", element: <div data-testid="ex">ok</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole("button", { name: "weak-card" }));

    assertNavigationContract(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weak_skill_click",
      expect.objectContaining({ skill: "Emergency Fund" })
    );
  });

  it("navigates with shared contract for practice CTA", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <NavigationHarness /> },
        { path: "/exercises", element: <div>ok</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole("button", { name: "practice" }));

    assertNavigationContract(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "improve_recommendation_click",
      expect.objectContaining({ skill: "Emergency Fund" })
    );
  });

  it("navigates with shared contract for quick card CTA", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <NavigationHarness /> },
        { path: "/exercises", element: <div>ok</div> },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole("button", { name: "quick-card" }));

    assertNavigationContract(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "quick_card_exercises_click",
      expect.objectContaining({ skill: "Emergency Fund" })
    );
  });
});
