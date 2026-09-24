import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TODAY = 5;
const STREAK_BEFORE_TODAY = 5;
const TODAY_XP = 45;

export default function StreakScreen() {
  const { t } = useTranslation();
  const [doneToday, setDoneToday] = useState(false);
  const streak = STREAK_BEFORE_TODAY + (doneToday ? 1 : 0);

  const league = [
    { name: "Maya", xp: 410, you: false },
    {
      name: t("welcome.phone.streak.you"),
      xp: 385 + (doneToday ? TODAY_XP : 0),
      you: true,
    },
    { name: "Tom", xp: 340, you: false },
  ].sort((a, b) => b.xp - a.xp);

  return (
    <>
      <div className="gzh-streak__hero">
        <span className="gzh-streak__num">{streak}</span>
        <span className="gzh-streak__caption">
          {t("welcome.phone.streak.caption")}
        </span>
      </div>
      <div className="gzh-week">
        {WEEK.map((day, i) => {
          let state = "idle";
          if (i < streak) state = i === TODAY ? "today-done" : "done";
          else if (i === TODAY) state = "today";
          return (
            <div key={day} className="gzh-week__day">
              <div className="gzh-week__dot" data-state={state} />
              <span className="gzh-week__label">
                {t(`welcome.phone.streak.days.${day}`)}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className={`gzh-press gzh-press--streak ${doneToday ? "gzh-press--done" : "gzh-press--green"}`}
        aria-pressed={doneToday}
        onClick={() => setDoneToday((done) => !done)}
      >
        {doneToday
          ? t("welcome.phone.streak.done", { xp: TODAY_XP })
          : t("welcome.phone.streak.finish")}
      </button>
      <div className="gzh-panel">
        <span className="gzh-eyebrow gzh-eyebrow--sm gzh-eyebrow--faint">
          {t("welcome.phone.streak.league")}
        </span>
        {league.map((row, i) => (
          <div key={row.name} className="gzh-league__row" data-you={row.you}>
            <span>
              {i + 1}. {row.name}
            </span>
            <span>{t("welcome.phone.streak.xp", { xp: row.xp })}</span>
          </div>
        ))}
      </div>
    </>
  );
}
