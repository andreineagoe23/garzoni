import type { Href } from "expo-router";

/** Typed routes lag file-based routes; use until expo-router regenerates link types. */
export function href(path: string): Href {
  return path as Href;
}
