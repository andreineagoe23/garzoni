import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchUserSettings, queryKeys, staleTimes } from "@garzoni/core";
import { useAuthSession } from "../auth/AuthContext";

/**
 * True when mascot UI should avoid decorative motion (OS reduce motion or
 * learner turned off animations in settings).
 */
export function useMascotMotionSimplify(): boolean {
  const { accessToken } = useAuthSession();
  const [reduceMotionSystem, setReduceMotionSystem] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotionSystem(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionSystem,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const settingsQ = useQuery({
    queryKey: queryKeys.userSettings(),
    queryFn: () => fetchUserSettings().then((r) => r.data),
    staleTime: staleTimes.profile,
    enabled: Boolean(accessToken),
  });

  return useMemo(() => {
    const animationsOff = settingsQ.data?.animations_enabled === false;
    return reduceMotionSystem || animationsOff;
  }, [reduceMotionSystem, settingsQ.data?.animations_enabled]);
}
