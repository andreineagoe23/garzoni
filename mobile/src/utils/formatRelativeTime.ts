/** Compact relative time for activity lists (uses Intl). */
export function formatRelativeTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";

  const diffSec = Math.round((Date.now() - t) / 1000);
  const abs = Math.abs(diffSec);
  const past = diffSec > 0;
  const sign = past ? -1 : 1;

  const absToValueAndUnit = (): {
    value: number;
    unit: Intl.RelativeTimeFormatUnit;
  } => {
    if (abs < 60) return { value: Math.max(1, abs), unit: "second" };
    const min = Math.round(abs / 60);
    if (min < 60) return { value: min, unit: "minute" };
    const hrs = Math.round(abs / 3600);
    if (hrs < 48) return { value: hrs, unit: "hour" };
    const days = Math.round(abs / 86400);
    if (days < 30) return { value: days, unit: "day" };
    const months = Math.round(days / 30);
    if (months < 12) return { value: months, unit: "month" };
    return { value: Math.round(months / 12), unit: "year" };
  };

  const { value, unit } = absToValueAndUnit();
  const maybeRtf = (globalThis as { Intl?: typeof Intl }).Intl?.RelativeTimeFormat;
  if (typeof maybeRtf === "function") {
    return new maybeRtf(locale, { numeric: "auto" }).format(sign * value, unit);
  }

  // Fallback for runtimes without Intl.RelativeTimeFormat (older JS engines).
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return past ? `${label} ago` : `in ${label}`;
}
