import type { TFunction } from "i18next";
import type { MobileToolDef } from "./mobileToolsRegistry";

/** Mobile tool id → locale entry id (web catalog may use a different slug). */
export function toolLocaleEntryId(toolId: string): string {
  if (toolId === "savings-goals") return "financial-goals";
  return toolId;
}

export function localizedToolTitle(t: TFunction, tool: MobileToolDef): string {
  const id = toolLocaleEntryId(tool.id);
  return t(`tools.entries.${id}.title`, { defaultValue: tool.title });
}

export function localizedToolSubtitle(
  t: TFunction,
  tool: MobileToolDef,
): string {
  const id = toolLocaleEntryId(tool.id);
  return t(`tools.entries.${id}.promise`, { defaultValue: tool.subtitle });
}

/** Duration chip on tool cards (works on older bundles missing tools.hub.estimatedMinutes). */
export function localizedToolMinutes(t: TFunction, minutes: number): string {
  const fallback = `${minutes} min`;
  const out = t("tools.hub.estimatedMinutes", {
    count: minutes,
    defaultValue: fallback,
  });
  if (!out || out === "tools.hub.estimatedMinutes") return fallback;
  return out;
}
