import { useEffect, useMemo, useState } from "react";
import { useAuth } from "contexts/AuthContext";
import { usePreferences } from "./usePreferences";

/**
 * True when mascot UI should drop decorative motion / heavy glass (system
 * reduced-motion, dashboard preference, or account animations off).
 */
export function useMascotMotionSimplify(): boolean {
  const { preferences } = usePreferences();
  const { settings } = useAuth();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return useMemo(() => {
    const animationsOff =
      settings != null &&
      (settings as { animations_enabled?: boolean }).animations_enabled ===
        false;
    return (
      prefersReducedMotion ||
      Boolean(preferences.reducedMotion) ||
      animationsOff
    );
  }, [prefersReducedMotion, preferences.reducedMotion, settings]);
}
