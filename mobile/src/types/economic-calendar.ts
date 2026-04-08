export type ImpactLevel = "high" | "medium" | "low";

export type CalendarEvent = {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  time?: string;
  name: string;
  impact: ImpactLevel;
  forecast?: string;
  actual?: string;
  currency?: string;
};

export type FilterOption = "all" | "high" | "medium" | "low";

export function groupEventsByDate(
  events: CalendarEvent[],
): { date: string; data: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, data }));
}

export function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export const IMPACT_COLORS: Record<ImpactLevel, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};
