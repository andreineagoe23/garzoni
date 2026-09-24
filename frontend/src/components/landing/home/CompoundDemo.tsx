import React, { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { GlassCard } from "components/ui";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  compoundChart,
  futureValue,
} from "./compound";
import { money, percent } from "./format";

const LATE_START_YEARS = 5;

export default function CompoundDemo() {
  const { t } = useTranslation();
  const [monthly, setMonthly] = useState(150);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(7);
  const chart = useMemo(
    () => compoundChart(monthly, years, rate),
    [monthly, years, rate]
  );

  const late =
    years > LATE_START_YEARS
      ? futureValue(monthly, years - LATE_START_YEARS, rate)
      : 0;
  const insight =
    years > LATE_START_YEARS
      ? t("welcome.demo.insightLate", {
          late: money(late),
          difference: money(chart.total - late),
        })
      : t("welcome.demo.insightShort");

  const controls = [
    {
      id: "gzh-demo-monthly",
      label: t("welcome.demo.monthly"),
      value: money(monthly),
      min: 10,
      max: 1000,
      step: 10,
      current: monthly,
      set: setMonthly,
    },
    {
      id: "gzh-demo-years",
      label: t("welcome.demo.years"),
      value: String(years),
      min: 1,
      max: 40,
      step: 1,
      current: years,
      set: setYears,
    },
    {
      id: "gzh-demo-rate",
      label: t("welcome.demo.rate"),
      value: percent(rate),
      min: 0,
      max: 12,
      step: 0.5,
      current: rate,
      set: setRate,
    },
  ];

  return (
    <section id="tools" className="gzh-section">
      <div className="gzh-container gzh-demo__inner">
        <div className="gzh-demo__head gzh-rise">
          <span className="gzh-demo__eyebrow">{t("welcome.demo.eyebrow")}</span>
          <h2 className="gzh-h2 gzh-h2--section">
            <Trans
              i18nKey="welcome.demo.headline"
              values={{
                monthly: money(monthly),
                years: t("welcome.demo.yearsCount", { count: years }),
                total: money(chart.total),
              }}
              components={{
                accent: <span key="accent" className="gzh-accent" />,
              }}
            />
          </h2>
        </div>
        <div className="gzh-rise gzh-rise--25">
          <GlassCard padding="none">
            <div className="gzh-demo__grid">
              <div className="gzh-demo__controls">
                {controls.map((c) => (
                  <div key={c.id} className="gzh-demo__control">
                    <div className="gzh-demo__control-head">
                      <label htmlFor={c.id}>{c.label}</label>
                      <span className="gzh-slider__value">{c.value}</span>
                    </div>
                    <input
                      id={c.id}
                      className="gzh-range"
                      type="range"
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={c.current}
                      onChange={(e) => c.set(Number(e.target.value))}
                    />
                  </div>
                ))}
                <div className="gzh-insight gzh-insight--coach">
                  <span className="gzh-eyebrow gzh-eyebrow--sm gzh-eyebrow--green">
                    {t("welcome.demo.coachLabel")}
                  </span>
                  <span className="gzh-insight__text">{insight}</span>
                </div>
              </div>
              <div className="gzh-demo__chart">
                <div className="gzh-legend">
                  <span className="gzh-legend__item">
                    <span className="gzh-legend__swatch gzh-legend__swatch--contrib" />
                    {t("welcome.demo.putIn")}{" "}
                    <b className="gzh-legend__value">
                      {money(chart.contributions)}
                    </b>
                  </span>
                  <span className="gzh-legend__item">
                    <span className="gzh-legend__swatch gzh-legend__swatch--growth" />
                    {t("welcome.demo.growth")}{" "}
                    <b className="gzh-legend__value">
                      {money(chart.total - chart.contributions)}
                    </b>
                  </span>
                </div>
                <svg
                  className="gzh-chart"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={t("welcome.demo.chartLabel", {
                    total: money(chart.total),
                    contributions: money(chart.contributions),
                  })}
                >
                  {[65, 130, 195].map((y) => (
                    <line
                      key={y}
                      className="gzh-chart__grid"
                      x1="0"
                      y1={y}
                      x2={CHART_WIDTH}
                      y2={y}
                    />
                  ))}
                  <path className="gzh-chart__total-area" d={chart.totalArea} />
                  <path
                    className="gzh-chart__total-line"
                    d={chart.totalLine}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    className="gzh-chart__contrib-area"
                    d={chart.contribArea}
                  />
                </svg>
                <span className="gzh-demo__note">
                  {t("welcome.demo.disclaimer")}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
