import { Redirect, useLocalSearchParams } from "expo-router";
import { href } from "../src/navigation/href";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Deep link parity with web `/personalized-path`: opens Learn with the Personalized path view selected.
 * Forwards optional web checkout params so Learn can refresh entitlements when needed.
 */
export default function PersonalizedPathRedirectScreen() {
  const params = useLocalSearchParams<{
    session_id?: string | string[];
    redirect?: string | string[];
  }>();
  const sessionId = firstParam(params.session_id);
  const redirect = firstParam(params.redirect);

  const qs = new URLSearchParams();
  qs.set("view", "personalized");
  if (sessionId) qs.set("session_id", sessionId);
  if (redirect) qs.set("redirect", redirect);

  return <Redirect href={href(`/(tabs)/learn?${qs.toString()}`)} />;
}
