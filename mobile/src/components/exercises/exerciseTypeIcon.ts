/**
 * Icon names for exercise list rows (Phase 4 polish).
 */
export function exerciseTypeIconName(type: string | undefined): string {
  const key = type?.trim() ?? "";
  const map: Record<string, string> = {
    "multiple-choice": "checkbox-marked-circle-outline",
    numeric: "calculator-variant-outline",
    "drag-and-drop": "cursor-move",
    "budget-allocation": "chart-pie-outline",
    "fill-in-table": "table-large",
    "scenario-simulation": "theater",
  };
  return map[key] ?? "dumbbell";
}
