export function formatCountdown(
  endsAt: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!endsAt) return "";
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  let remaining = Math.max(0, Math.floor((end - now) / 1000));
  if (remaining === 0) return t("common.justNow", { defaultValue: "now" });

  const days = Math.floor(remaining / 86400);
  remaining -= days * 86400;
  const hours = Math.floor(remaining / 3600);
  remaining -= hours * 3600;
  const minutes = Math.floor(remaining / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPast(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
