/** Compact relative time for activity lists (uses Intl). */
export function formatRelativeTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";

  const diffSec = Math.round((Date.now() - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const abs = Math.abs(diffSec);
  const past = diffSec > 0;
  const sign = past ? -1 : 1;

  if (abs < 60) return rtf.format(sign * Math.max(1, abs), "second");
  const min = Math.round(abs / 60);
  if (min < 60) return rtf.format(sign * min, "minute");
  const hrs = Math.round(abs / 3600);
  if (hrs < 48) return rtf.format(sign * hrs, "hour");
  const days = Math.round(abs / 86400);
  if (days < 30) return rtf.format(sign * days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(sign * months, "month");
  return rtf.format(sign * Math.round(months / 12), "year");
}
