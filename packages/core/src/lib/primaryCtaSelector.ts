import type { Mission } from "types/api";

type PrimaryCtaInput = {
  reviewsDue: number;
  activeMissions: Mission[];
};

export const selectPrimaryCTA = ({
  reviewsDue,
  activeMissions,
}: PrimaryCtaInput) => {
  if (reviewsDue > 0) {
    return {
      type: "reviews_due" as const,
      iconName: "book" as const,
      reasonKey: "cta.reviewsDue",
      reasonCount: reviewsDue,
    };
  }

  if (activeMissions.length > 0) {
    const lessonMission = activeMissions.find(
      (mission) => mission.goal_type === "complete_lesson"
    );
    if (lessonMission) {
      return {
        type: "continue_lesson" as const,
        iconName: "bookOpen" as const,
        reasonKey: "cta.activeLesson",
        mission: lessonMission,
      };
    }
    return {
      type: "start_mission" as const,
      iconName: "rocket" as const,
      reasonKey: "cta.activeMissions",
      reasonCount: activeMissions.length,
    };
  }

  return {
    type: "continue_learning" as const,
    iconName: "rocket" as const,
    reasonKey: "cta.keepMomentum",
  };
};
