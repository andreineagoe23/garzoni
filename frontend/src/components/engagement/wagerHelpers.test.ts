import { describe, expect, it } from "vitest";
import { daysLeftToDeadline, previewDeadlineOn } from "./wagerHelpers";

describe("daysLeftToDeadline", () => {
  it("is 0 when the deadline is today", () => {
    expect(daysLeftToDeadline("2026-07-25", "2026-07-25")).toBe(0);
  });

  it("counts whole calendar days remaining", () => {
    expect(daysLeftToDeadline("2026-08-01", "2026-07-25")).toBe(7);
  });

  it("clamps to 0 for a deadline already in the past", () => {
    expect(daysLeftToDeadline("2026-07-20", "2026-07-25")).toBe(0);
  });
});

describe("previewDeadlineOn", () => {
  it("adds target_days to today", () => {
    expect(previewDeadlineOn(7, "2026-07-25")).toBe("2026-08-01");
  });

  it("crosses a year boundary", () => {
    expect(previewDeadlineOn(14, "2026-12-25")).toBe("2027-01-08");
  });

  it("treats 0/negative target_days as today (defensive)", () => {
    expect(previewDeadlineOn(0, "2026-07-25")).toBe("2026-07-25");
    expect(previewDeadlineOn(-5, "2026-07-25")).toBe("2026-07-25");
  });
});
