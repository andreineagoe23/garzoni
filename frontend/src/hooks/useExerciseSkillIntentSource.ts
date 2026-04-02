import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  normalizeExercisesSkillReason,
  type ExercisesSkillReason,
} from "utils/exercisesSkillNavigation";

export type ExerciseSkillIntentLocationState = {
  from?: string;
  targetSkill?: string;
  reason?: string;
};

/**
 * Reads durable skill deep-link intent from the URL (?skill=) and optional
 * navigation state (dashboard metadata). Query param wins over state.targetSkill.
 */
export function useExerciseSkillIntentSource() {
  const location = useLocation();

  const targetSkillIntent = useMemo(() => {
    const querySkill = new URLSearchParams(location.search).get("skill") || "";
    const locState = location.state as ExerciseSkillIntentLocationState | null;
    const stateSkill = locState?.targetSkill || "";
    return (querySkill || stateSkill).trim();
  }, [location.search, location.state]);

  const intentReason = useMemo(() => {
    const locState = location.state as ExerciseSkillIntentLocationState | null;
    return normalizeExercisesSkillReason(locState?.reason);
  }, [location.state]);

  const intentFromDashboard = useMemo(() => {
    const locState = location.state as ExerciseSkillIntentLocationState | null;
    return locState?.from === "dashboard";
  }, [location.state]);

  const intentSource: "query" | "state" | "none" = useMemo(() => {
    const q = new URLSearchParams(location.search).get("skill")?.trim();
    const locState = location.state as ExerciseSkillIntentLocationState | null;
    if (q) return "query";
    if (locState?.targetSkill?.trim()) return "state";
    return "none";
  }, [location.search, location.state]);

  const rawReason = useMemo(() => {
    const locState = location.state as ExerciseSkillIntentLocationState | null;
    return locState?.reason;
  }, [location.state]);

  return {
    targetSkillIntent,
    intentReason,
    intentFromDashboard,
    intentSource,
    rawReason,
  };
}

export type { ExercisesSkillReason };
