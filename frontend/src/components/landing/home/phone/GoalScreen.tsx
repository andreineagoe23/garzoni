import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const GOALS = ["budget", "debt", "savings", "investing"] as const;
type Goal = (typeof GOALS)[number];

/** The first two lessons each goal's path opens with. */
const PATH_START: Record<Goal, [string, string]> = {
  budget: ["whereMoneyGoes", "rule503020"],
  debt: ["howAprWorks", "avalancheSnowball"],
  savings: ["emergencyFunds", "automatingSavings"],
  investing: ["compoundGrowth", "indexFunds"],
};

export default function GoalScreen() {
  const { t } = useTranslation();
  const [goal, setGoal] = useState<Goal>("savings");

  return (
    <>
      <span className="gzh-goal__title">{t("welcome.phone.goal.title")}</span>
      <div className="gzh-goal__grid">
        {GOALS.map((key) => (
          <button
            key={key}
            type="button"
            className="gzh-goal"
            aria-pressed={goal === key}
            onClick={() => setGoal(key)}
          >
            <span className="gzh-goal__name">
              {t(`welcome.phone.goal.goals.${key}.title`)}
            </span>
            <span className="gzh-goal__sub">
              {t(`welcome.phone.goal.goals.${key}.sub`)}
            </span>
          </button>
        ))}
      </div>
      <div className="gzh-path">
        <span className="gzh-eyebrow gzh-eyebrow--sm gzh-eyebrow--faint">
          {t("welcome.phone.goal.pathLabel")}
        </span>
        {PATH_START[goal].map((lesson, i) => (
          <div key={lesson} className="gzh-path__item">
            <span
              className={`gzh-path__num${i === 0 ? " gzh-path__num--first" : ""}`}
            >
              {i + 1}
            </span>
            {t(`welcome.phone.goal.lessons.${lesson}`)}
          </div>
        ))}
      </div>
    </>
  );
}
