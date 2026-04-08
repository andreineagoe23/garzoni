/** Normalize lesson payload `course` (pk, string id, or nested { id }) to a positive course id, or 0. */
export function parseCourseIdFromLesson(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (raw && typeof raw === "object" && "id" in raw) {
    const n = Number((raw as { id: unknown }).id);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  return 0;
}
