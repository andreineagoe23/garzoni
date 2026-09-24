import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { money } from "../format";

const MONTHLY_BUDGET = 2840;
const NEEDS_PCT = 42;
const CUSHION = 6000;
const BASELINE_PCT = 30;
const BASELINE_MONTHS = Math.ceil(
  CUSHION / ((MONTHLY_BUDGET * BASELINE_PCT) / 100)
);

export default function BudgetScreen() {
  const { t } = useTranslation();
  const [save, setSave] = useState(BASELINE_PCT);
  const wants = 100 - NEEDS_PCT - save;
  const saveMonthly = (MONTHLY_BUDGET * save) / 100;
  const months = Math.ceil(CUSHION / saveMonthly);

  const insightVars = {
    pct: save,
    baseline: BASELINE_PCT,
    base: BASELINE_MONTHS,
    cushion: money(CUSHION),
    count: months,
  };
  let insight: string;
  if (months < BASELINE_MONTHS) {
    insight = t("welcome.phone.budget.sooner", {
      ...insightVars,
      diff: BASELINE_MONTHS - months,
    });
  } else if (months > BASELINE_MONTHS) {
    insight = t("welcome.phone.budget.later", {
      ...insightVars,
      diff: months - BASELINE_MONTHS,
    });
  } else {
    insight = t("welcome.phone.budget.same", insightVars);
  }

  return (
    <>
      <span className="gzh-eyebrow gzh-eyebrow--faint">
        {t("welcome.phone.budget.label")}
      </span>
      <span className="gzh-budget__label">
        {t("welcome.phone.budget.monthly")}
      </span>
      <span className="gzh-budget__total">{money(MONTHLY_BUDGET)}</span>
      <div className="gzh-split" aria-hidden="true">
        <span
          className="gzh-split__part gzh-split__part--needs"
          style={{ flex: NEEDS_PCT }}
        />
        <span
          className="gzh-split__part gzh-split__part--wants"
          style={{ flex: wants }}
        />
        <span
          className="gzh-split__part gzh-split__part--save"
          style={{ flex: save }}
        />
      </div>
      <div className="gzh-split__legend">
        <span>{t("welcome.phone.budget.needs", { pct: NEEDS_PCT })}</span>
        <span>{t("welcome.phone.budget.wants", { pct: wants })}</span>
        <span className="gzh-split__legend-save">
          {t("welcome.phone.budget.save", { pct: save })}
        </span>
      </div>
      <div className="gzh-slider">
        <div className="gzh-slider__head">
          <label htmlFor="gzh-budget-save">
            {t("welcome.phone.budget.drag")}
          </label>
          <span className="gzh-slider__value">
            {t("welcome.phone.budget.perMonth", { amount: money(saveMonthly) })}
          </span>
        </div>
        <input
          id="gzh-budget-save"
          className="gzh-range"
          type="range"
          min={10}
          max={50}
          step={1}
          value={save}
          onChange={(e) => setSave(Number(e.target.value))}
        />
      </div>
      <div className="gzh-insight">
        <span className="gzh-eyebrow gzh-eyebrow--sm gzh-eyebrow--green">
          {t("welcome.phone.budget.insightLabel")}
        </span>
        <span className="gzh-insight__text">{insight}</span>
      </div>
    </>
  );
}
