import React from "react";
import { render, screen } from "@testing-library/react";
import type { MissionBuckets, ProgressSummary } from "types/api";
import { useDashboardSummary } from "./useDashboardSummary";

type SummaryViewProps = {
  progressResponse?: { data?: ProgressSummary };
  reviewQueueData?: { count?: number };
  missionsData?: MissionBuckets;
  masteryData?: {
    masteries?: Array<{
      proficiency?: number;
      course_title?: string | null;
      next_step?: { type?: string };
    }>;
  };
};

const SummaryView = (props: SummaryViewProps) => {
  const summary = useDashboardSummary(props);
  return (
    <div>
      <span>courses:{summary.coursesCompleted}</span>
      <span>reviews:{summary.reviewsDue}</span>
      <span>missions:{summary.activeMissions.length}</span>
      <span>weak:{summary.weakestSkills.length}</span>
      <span>next:{summary.weakestSkills[0]?.next_step?.type ?? "none"}</span>
      <span>course:{summary.weakestSkills[0]?.course_title ?? "none"}</span>
    </div>
  );
};

describe("useDashboardSummary", () => {
  it("computes summary values from payloads", () => {
    render(
      <SummaryView
        progressResponse={{
          data: {
            paths: [{ percent_complete: 100 }, { percent_complete: 50 }],
          },
        }}
        reviewQueueData={{ count: 3 }}
        missionsData={{
          daily_missions: [{ id: 1, status: "in_progress" }],
          weekly_missions: [{ id: 2, status: "complete" }],
        }}
        masteryData={{
          masteries: [
            { proficiency: 40 },
            { proficiency: 90 },
            { proficiency: 60 },
          ],
        }}
      />
    );

    expect(screen.getByText("courses:1")).toBeInTheDocument();
    expect(screen.getByText("reviews:3")).toBeInTheDocument();
    expect(screen.getByText("missions:2")).toBeInTheDocument();
    expect(screen.getByText("weak:2")).toBeInTheDocument();
  });

  it("caps weakest skills at 3 even when more are meaningful", () => {
    render(
      <SummaryView
        masteryData={{
          masteries: [
            { proficiency: 10 },
            { proficiency: 20 },
            { proficiency: 30 },
            { proficiency: 40 },
            { proficiency: 50 },
          ],
        }}
      />
    );

    expect(screen.getByText("weak:3")).toBeInTheDocument();
  });

  it("passes next_step through weakestSkills", () => {
    render(
      <SummaryView
        masteryData={{
          masteries: [
            {
              proficiency: 10,
              course_title: "Emergency Fund",
              next_step: { type: "lesson" },
            },
          ],
        }}
      />
    );

    expect(screen.getByText("next:lesson")).toBeInTheDocument();
    expect(screen.getByText("course:Emergency Fund")).toBeInTheDocument();
  });
});
