import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Legacy deep link: `/path/:id` now opens Learn with that path expanded (web-style catalog, no extra screen).
 */
export default function PathRedirectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const raw = String(id ?? "").trim();
  if (!raw) {
    return <Redirect href="/(tabs)/learn" />;
  }
  return <Redirect href={`/(tabs)/learn?expandPath=${encodeURIComponent(raw)}`} />;
}
