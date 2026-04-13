/**
 * Normalizes GET /exercises/:id/ payloads for mobile renderers that historically
 * only read `exercise_data` (while the API keeps `question` top-level, etc.).
 */

export type StandaloneExerciseViewModel = {
  exerciseType: string;
  mergedData: Record<string, unknown>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/**
 * @param detail — parsed JSON from `GET /exercises/:id/`
 */
export function buildStandaloneExerciseViewModel(
  detail: Record<string, unknown>,
): StandaloneExerciseViewModel {
  const exerciseType = String(detail.type ?? "").trim();
  const rootQuestion =
    typeof detail.question === "string" ? detail.question : "";
  const raw = asRecord(detail.exercise_data) ?? {};
  const merged: Record<string, unknown> = { ...raw };

  if (
    (merged.question === undefined ||
      merged.question === null ||
      String(merged.question).trim() === "") &&
    rootQuestion
  ) {
    merged.question = rootQuestion;
  }

  if (exerciseType === "budget-allocation") {
    if (merged.total == null && typeof merged.income === "number") {
      merged.total = merged.income;
    }
  }

  if (exerciseType === "drag-and-drop") {
    const itemsRaw = merged.items;
    if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
      if (typeof itemsRaw[0] === "string") {
        const items = (itemsRaw as string[]).map((label, i) => ({
          id: i,
          label,
        }));
        merged.items = items;
        merged.targets = items.map((it: { id: number; label: string }) => ({
          id: it.id,
          label: it.label,
        }));
      } else if (
        !Array.isArray(merged.targets) ||
        merged.targets.length === 0
      ) {
        const objs = itemsRaw as { id?: unknown; label?: unknown }[];
        merged.targets = objs.map((it, i) => ({
          id: it.id ?? i,
          label: typeof it.label === "string" ? it.label : String(it.id ?? i),
        }));
      }
    }
  }

  if (exerciseType === "fill-in-table") {
    const table = asRecord(merged.table);
    if (table) {
      const cols = table.columns;
      const rowList = table.rows;
      if (Array.isArray(cols)) merged.columns = cols;
      if (Array.isArray(rowList)) {
        merged.rows = rowList.map((r: unknown, i: number) => {
          const o = asRecord(r);
          if (o && "id" in o) {
            return {
              id: String(o.id),
              label:
                typeof o.label === "string" ? o.label : String(o.label ?? o.id),
            };
          }
          return { id: `row-${i}`, label: String(r) };
        });
      }
    }
  }

  return { exerciseType, mergedData: merged };
}
