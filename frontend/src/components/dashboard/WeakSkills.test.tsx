import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import WeakSkills from "./WeakSkills";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "dashboard.weakSkills.action.continueImproving") {
        return "Continue improving";
      }
      if (key === "dashboard.weakSkills.nextPreview") {
        return `Next: ${opts?.type} — ${opts?.title}`;
      }
      if (key === "dashboard.weakSkills.nextType.lesson") {
        return "Lesson";
      }
      if (key === "dashboard.weakSkills.action.askTutor") {
        return "Ask tutor";
      }
      if (key === "dashboard.weakSkills.action.askTutorAbout") {
        return `Ask tutor about ${opts?.skill}`;
      }
      return key;
    },
  }),
}));

describe("WeakSkills", () => {
  it("renders Continue improving CTA and next-step preview", () => {
    render(
      <WeakSkills
        weakestSkills={[
          {
            skill: "Saving",
            course_title: "Emergency Fund",
            proficiency: 24,
            next_step: {
              type: "lesson",
              target_id: 12,
              course_id: 3,
              title: "Save More",
            },
          },
        ]}
        hasAnyMasteryData
      />
    );

    expect(screen.getByText("Continue improving")).toBeInTheDocument();
    expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByText(/Next:.*Save More/)).toBeInTheDocument();
  });

  it("renders one action when next step is tutor", () => {
    render(
      <WeakSkills
        weakestSkills={[
          {
            skill: "Saving",
            course_title: "Emergency Fund",
            proficiency: 24,
            next_step: {
              type: "tutor",
              target_id: null,
              course_id: 3,
              title: null,
            },
          },
        ]}
        hasAnyMasteryData
      />
    );

    expect(
      screen.getByText("Ask tutor about Emergency Fund")
    ).toBeInTheDocument();
    expect(screen.queryByText("Ask tutor")).not.toBeInTheDocument();
  });
});
