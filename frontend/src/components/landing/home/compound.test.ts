import { balanceWithStart, compoundChart, futureValue } from "./compound";

describe("futureValue", () => {
  it("is plain saving at a 0% return", () => {
    expect(futureValue(150, 20, 0)).toBe(150 * 12 * 20);
  });

  it("compounds monthly at the annual rate", () => {
    // £150 a month for 20 years at 7%: the figure the landing page opens on.
    expect(Math.round(futureValue(150, 20, 7))).toBe(78139);
  });
});

describe("balanceWithStart", () => {
  it("adds the compounded lump sum to the deposits", () => {
    // £1,000 at 5% compounded monthly for 10 years is £1,647.01.
    expect(balanceWithStart(1000, 0, 10, 5)).toBeCloseTo(1647.01, 2);
    expect(balanceWithStart(1000, 150, 20, 7)).toBeCloseTo(
      1000 * Math.pow(1 + 0.07 / 12, 240) + futureValue(150, 20, 7),
      6
    );
  });
});

describe("compoundChart", () => {
  it("draws 41 samples per series and closes both areas", () => {
    const chart = compoundChart(150, 20, 7);

    expect(chart.totalLine.split(" ")).toHaveLength(41);
    expect(chart.totalArea.endsWith("L800,260 L0,260 Z")).toBe(true);
    expect(chart.contribArea.endsWith("L800,260 L0,260 Z")).toBe(true);
    expect(chart.contributions).toBe(36000);
  });
});
