import React from "react";
import { render, screen } from "@testing-library/react";
import type { MissionBuckets, ProgressSummary } from "types/api";
import { useDashboardSummary } from "./useDashboardSummary";

type SummaryViewProps = {
  progressResponse?: { data?: ProgressSummary };
  reviewQueueData?: { count?: number };
  missionsData?: MissionBuckets;
  masteryData?: { masteries?: Array<{ proficiency?: number }> };
};

const SummaryView = (props: SummaryViewProps) => {
  const summary = useDashboardSummary(props);
  return (
    <div>
      <span>courses:{summary.coursesCompleted}</span>
      <span>reviews:{summary.reviewsDue}</span>
      <span>missions:{summary.activeMissions.length}</span>
      <span>weak:{summary.weakestSkills.length}</span>
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
});
