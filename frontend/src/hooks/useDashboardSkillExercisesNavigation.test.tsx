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
    handleWeakSkillReview,
    handleWeakSkillPrimaryAction,
    handleContinueImproving,
  } = useDashboardSkillExercisesNavigation(navigate, mockTrackEvent);

  const skill = { skill: "Emergency Fund", proficiency: 18 };
  const dueSkill = {
    skill: "Emergency Fund",
    proficiency: 18,
    recommended_action: "review" as const,
    review_exercise_id: 99,
    overdue_days: 2,
  };
  const lessonSkill = {
    skill: "Emergency Fund",
    proficiency: 18,
    next_step: {
      type: "lesson" as const,
      target_id: 7,
      course_id: 3,
      title: "Build a fund",
    },
  };

  return (
    <div>
      <button type="button" onClick={() => handleWeakSkillClick(skill)}>
        weak-card
      </button>
      <button type="button" onClick={() => handleWeakSkillPractice(skill)}>
        practice
      </button>
      <button type="button" onClick={() => handleWeakSkillReview(dueSkill)}>
        review
      </button>
      <button
        type="button"
        onClick={() => handleWeakSkillPrimaryAction(dueSkill)}
      >
        primary-due
      </button>
      <button type="button" onClick={() => handleWeakSkillPrimaryAction(skill)}>
        primary-practice
      </button>
      <button
        type="button"
        onClick={() => handleContinueImproving(lessonSkill)}
      >
        continue-lesson
      </button>
    </div>
  );
}

function assertNavigationContract(loc: { pathname: string; search: string }) {
  expect(loc.pathname).toBe("/exercises");
  const params = new URLSearchParams(loc.search);
  expect(params.get("skill")).toBe("Emergency Fund");
}

function renderHarness() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <NavigationHarness /> },
      { path: "/exercises", element: <div data-testid="ex">ok</div> },
      {
        path: "/lessons/:courseId/flow",
        element: <div data-testid="flow">flow</div>,
      },
    ],
    { initialEntries: ["/"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("useDashboardSkillExercisesNavigation", () => {
  beforeEach(() => {
    mockTrackEvent.mockReset();
  });

  it("navigates with shared contract for weak skill card click", async () => {
    const router = renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "weak-card" }));
    assertNavigationContract(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weak_skill_click",
      expect.objectContaining({ skill: "Emergency Fund" })
    );
  });

  it("navigates with shared contract for practice CTA", async () => {
    const router = renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "practice" }));
    assertNavigationContract(router.state.location);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "improve_recommendation_click",
      expect.objectContaining({ skill: "Emergency Fund" })
    );
  });

  it("routes Review CTA with exerciseId param + dedicated analytics", async () => {
    const router = renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "review" }));
    assertNavigationContract(router.state.location);
    expect(router.state.location.search).toContain("exerciseId=99");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weak_skill_review_click",
      expect.objectContaining({ skill: "Emergency Fund", overdue_days: 2 })
    );
  });

  it("primary action dispatches review when skill is due", async () => {
    renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "primary-due" }));
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weak_skill_review_click",
      expect.any(Object)
    );
  });

  it("primary action falls back to practice when not due", async () => {
    renderHarness();
    await userEvent.click(
      screen.getByRole("button", { name: "primary-practice" })
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "improve_recommendation_click",
      expect.any(Object)
    );
  });

  it("continue improving routes to lesson flow with lessonId", async () => {
    const router = renderHarness();
    await userEvent.click(
      screen.getByRole("button", { name: "continue-lesson" })
    );
    expect(router.state.location.pathname).toBe("/lessons/3/flow");
    expect(router.state.location.search).toBe("?lessonId=7");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "improve_recommendation_click",
      expect.objectContaining({
        skill: "Emergency Fund",
        next_step_type: "lesson",
        target_id: 7,
      })
    );
  });
});
