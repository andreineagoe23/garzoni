import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { NavigateFunction, Location } from "react-router-dom";
import type { TFunction } from "i18next";
import { resolveCategoryFromSkill } from "utils/resolveCategoryFromSkill";
import { useExerciseSkillIntentSource } from "hooks/useExerciseSkillIntentSource";
import type { ExerciseIntentBannerModel } from "components/exercises/ExerciseIntentBanner";
import type { AnalyticsEvent } from "types/analytics";

export type ExerciseIntentResolution =
  | { status: "idle" }
  | { status: "unmapped"; skill: string }
  | { status: "mapped"; skill: string; category: string };

export type ExerciseFilters = {
  type: string;
  category: string;
  difficulty: string;
};

type TrackFn = (
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>
) => void;

type UseExerciseSkillIntentParams = {
  categories: string[];
  categoriesResolved: boolean;
  setFilters: React.Dispatch<React.SetStateAction<ExerciseFilters>>;
  filtersRef: React.MutableRefObject<ExerciseFilters>;
  navigate: NavigateFunction;
  location: Location;
  t: TFunction;
  trackEvent: TrackFn;
  /** Reset lesson session UI when skill intent applies a mapped category filter. */
  onIntentMatchedApplyLessonReset: () => void;
};

/**
 * Owns the exercises page skill-intent lifecycle: read source, resolve category,
 * sync ?skill= in the URL, banner + resolution models, dismiss / manual override.
 */
export function useExerciseSkillIntent({
  categories,
  categoriesResolved,
  setFilters,
  filtersRef,
  navigate,
  location,
  t,
  trackEvent,
  onIntentMatchedApplyLessonReset,
}: UseExerciseSkillIntentParams) {
  const {
    targetSkillIntent,
    intentReason,
    intentFromDashboard,
    intentSource,
  } = useExerciseSkillIntentSource();

  const [intentResolution, setIntentResolution] = useState<ExerciseIntentResolution>(
    { status: "idle" }
  );
  const [skillIntentBanner, setSkillIntentBanner] =
    useState<ExerciseIntentBannerModel | null>(null);
  const [skillBannerDismissed, setSkillBannerDismissed] = useState(false);
  const [skillFetchReady, setSkillFetchReady] = useState(false);

  const appliedSkillIntentRef = useRef<string | null>(null);
  const locationStateRef = useRef(location.state);
  locationStateRef.current = location.state;

  const skillBannerSubtitle = useMemo(() => {
    if (!intentFromDashboard) return "";
    if (intentReason) {
      const line = t(`exercises.skillIntent.context.${intentReason}`);
      return line || t("exercises.skillIntent.context.default");
    }
    return t("exercises.skillIntent.context.default");
  }, [intentFromDashboard, intentReason, t]);

  useLayoutEffect(() => {
    if (!targetSkillIntent.trim()) {
      setSkillFetchReady(true);
    } else {
      setSkillFetchReady(false);
    }
  }, [targetSkillIntent]);

  useEffect(() => {
    if (!targetSkillIntent?.trim()) {
      appliedSkillIntentRef.current = null;
      setSkillIntentBanner(null);
      setIntentResolution({ status: "idle" });
    }
  }, [targetSkillIntent]);

  useEffect(() => {
    if (!targetSkillIntent || !categoriesResolved) return;

    const syncBannerAndResolution = () => {
      if (categories.length === 0) {
        setSkillIntentBanner({ kind: "unmapped", skill: targetSkillIntent });
        setIntentResolution({ status: "unmapped", skill: targetSkillIntent });
        return;
      }
      const matched = resolveCategoryFromSkill(targetSkillIntent, categories);
      if (matched) {
        const differs =
          matched.trim().toLowerCase() !== targetSkillIntent.trim().toLowerCase();
        setSkillIntentBanner({
          kind: "applied",
          skill: targetSkillIntent,
          category: matched,
          differsFromSkill: differs,
        });
        setIntentResolution({
          status: "mapped",
          skill: targetSkillIntent,
          category: matched,
        });
      } else {
        setSkillIntentBanner({ kind: "unmapped", skill: targetSkillIntent });
        setIntentResolution({ status: "unmapped", skill: targetSkillIntent });
      }
    };

    if (appliedSkillIntentRef.current === targetSkillIntent) {
      syncBannerAndResolution();
      setSkillFetchReady(true);
      return;
    }

    appliedSkillIntentRef.current = targetSkillIntent;
    setSkillBannerDismissed(false);

    const base = filtersRef.current;

    if (categories.length === 0) {
      syncBannerAndResolution();
      setSkillFetchReady(true);
      return;
    }

    const matchedCategory = resolveCategoryFromSkill(
      targetSkillIntent,
      categories
    );

    if (matchedCategory) {
      const next = { ...base, category: matchedCategory };
      setFilters(next);
      onIntentMatchedApplyLessonReset();
    }

    syncBannerAndResolution();
    setSkillFetchReady(true);
  }, [
    categories,
    categoriesResolved,
    targetSkillIntent,
    filtersRef,
    setFilters,
    onIntentMatchedApplyLessonReset,
  ]);

  useEffect(() => {
    const skill = targetSkillIntent;
    if (!skill) return;
    const params = new URLSearchParams(location.search);
    if (params.get("skill") === skill) return;
    params.set("skill", skill);
    navigate(
      { pathname: "/exercises", search: `?${params.toString()}` },
      { replace: true, state: locationStateRef.current }
    );
  }, [targetSkillIntent, location.search, navigate]);

  const stripSkillFromLocation = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete("skill");
    const qs = params.toString();
    navigate(
      { pathname: "/exercises", search: qs ? `?${qs}` : "" },
      { replace: true, state: {} }
    );
  }, [navigate, location.search]);

  const dismissSkillRecommendation = useCallback(() => {
    trackEvent("exercise_skill_intent_cleared", {
      action: "dismiss_recommendation",
    });
    appliedSkillIntentRef.current = null;
    setSkillBannerDismissed(true);
    setSkillIntentBanner(null);
    setIntentResolution({ status: "idle" });
    stripSkillFromLocation();
  }, [stripSkillFromLocation, trackEvent]);

  const handleCategoryFilterChange = useCallback(
    (value: string) => {
      const hadSkill = new URLSearchParams(location.search).get("skill");
      if (hadSkill) {
        trackEvent("exercise_skill_intent_manual_category", {
          previous_skill_param: hadSkill,
          new_category: value,
        });
      }
      appliedSkillIntentRef.current = null;
      setSkillBannerDismissed(true);
      setSkillIntentBanner(null);
      setIntentResolution({ status: "idle" });
      stripSkillFromLocation();
      setFilters((prev) => ({ ...prev, category: value }));
    },
    [stripSkillFromLocation, trackEvent, location.search, setFilters]
  );

  /** Clear intent UI state only; page composes full “show all exercises” with navigate + filters. */
  const resetIntentUiForClearFilter = useCallback(() => {
    appliedSkillIntentRef.current = null;
    setSkillBannerDismissed(true);
    setSkillIntentBanner(null);
    setIntentResolution({ status: "idle" });
  }, []);

  return {
    targetSkillIntent,
    intentReason,
    intentFromDashboard,
    intentSource,
    skillFetchReady,
    intentResolution,
    skillIntentBanner,
    skillBannerDismissed,
    setSkillBannerDismissed,
    skillBannerSubtitle,
    dismissSkillRecommendation,
    handleCategoryFilterChange,
    resetIntentUiForClearFilter,
  };
}
