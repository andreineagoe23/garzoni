/** Future value of a monthly deposit: FV = m·((1+i)^n − 1)/i, with i = r/12 and n = years·12. */
export const futureValue = (
  monthly: number,
  years: number,
  ratePct: number
) => {
  const i = ratePct / 100 / 12;
  const n = years * 12;
  return i === 0 ? monthly * n : monthly * ((Math.pow(1 + i, n) - 1) / i);
};

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 260;
const SAMPLES = 40;

/** SVG paths for the growth chart: the total as a line and area, contributions as an area. */
export function compoundChart(monthly: number, years: number, ratePct: number) {
  const total = futureValue(monthly, years, ratePct);
  const contributions = monthly * 12 * years;
  const max = Math.max(total, 1) * 1.08;
  const x = (k: number) => ((k / SAMPLES) * CHART_WIDTH).toFixed(1);
  const y = (v: number) => (CHART_HEIGHT - (v / max) * CHART_HEIGHT).toFixed(1);

  const totalPoints: string[] = [];
  const contribPoints: string[] = [];
  for (let k = 0; k <= SAMPLES; k += 1) {
    const t = (k / SAMPLES) * years;
    const cmd = k ? "L" : "M";
    totalPoints.push(`${cmd}${x(k)},${y(futureValue(monthly, t, ratePct))}`);
    contribPoints.push(`${cmd}${x(k)},${y(monthly * 12 * t)}`);
  }
  const close = ` L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
  const totalLine = totalPoints.join(" ");

  return {
    total,
    contributions,
    totalLine,
    totalArea: totalLine + close,
    contribArea: contribPoints.join(" ") + close,
  };
}
