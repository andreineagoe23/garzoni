import React from "react";
import { render, screen } from "@testing-library/react";
import { useDashboardSummary } from "./useDashboardSummary";

const SummaryView = (props: any) => {
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
            paths: [{ percent_complete: 100 }, { percent_complete: 50 }] } }}
        reviewQueueData={{ count: 3 }}
        missionsData={{
          daily_missions: [{ status: "in_progress" }],
          weekly_missions: [{ status: "complete" }] }}
        masteryData={{
          masteries: [
            { proficiency: 40 },
            { proficiency: 90 },
            { proficiency: 60 },
          ] }}
      />
    );

    expect(screen.getByText("courses:1")).toBeInTheDocument();
    expect(screen.getByText("reviews:3")).toBeInTheDocument();
    expect(screen.getByText("missions:1")).toBeInTheDocument();
    expect(screen.getByText("weak:2")).toBeInTheDocument();
  });
});
