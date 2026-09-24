import React from "react";
import { useTranslation } from "react-i18next";

const TOPICS = [
  "budgeting",
  "saving",
  "creditScores",
  "investing",
  "taxes",
  "debtPayoff",
  "pensions",
  "emergencyFunds",
  "indexFunds",
  "payslips",
  "studentLoans",
  "compoundInterest",
] as const;

export default function TopicMarquee() {
  const { t } = useTranslation();
  // The list runs twice so the -50% loop joins without a gap.
  const chips = [...TOPICS, ...TOPICS];

  return (
    <section className="gzh-marquee" aria-label={t("welcome.marquee.label")}>
      <div className="gzh-marquee__track">
        {chips.map((key, i) => (
          <span
            key={`${key}-${i}`}
            className="gzh-chip"
            aria-hidden={i >= TOPICS.length || undefined}
          >
            <span className={`gzh-chip__dot gzh-chip__dot--${i % 3}`} />
            {t(`welcome.marquee.topics.${key}`)}
          </span>
        ))}
      </div>
    </section>
  );
}
