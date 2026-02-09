import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const FinancialDisclaimer = () => {
  const { t } = useTranslation();
  return (
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>
            {t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("legal.financialDisclaimer.title")}
          </h1>
        </header>

        <div className={contentClass}>
          <p>
            <Trans
              i18nKey="legal.financialDisclaimer.intro"
              components={{ strong: <strong /> }}
            />
          </p>

          <h2>{t("legal.financialDisclaimer.sections.meaning.title")}</h2>
          <ul>
            <li>{t("legal.financialDisclaimer.sections.meaning.items.general")}</li>
            <li>{t("legal.financialDisclaimer.sections.meaning.items.noProfile")}</li>
            <li>{t("legal.financialDisclaimer.sections.meaning.items.noRecommendation")}</li>
            <li>{t("legal.financialDisclaimer.sections.meaning.items.examples")}</li>
            <li>{t("legal.financialDisclaimer.sections.meaning.items.pastPerformance")}</li>
          </ul>

          <h2>{t("legal.financialDisclaimer.sections.responsibility.title")}</h2>
          <p>{t("legal.financialDisclaimer.sections.responsibility.body")}</p>

          <h2>{t("legal.financialDisclaimer.sections.warranty.title")}</h2>
          <p>{t("legal.financialDisclaimer.sections.warranty.body")}</p>

          <h2>{t("legal.financialDisclaimer.sections.related.title")}</h2>
          <p>
            <Trans
              i18nKey="legal.financialDisclaimer.sections.related.body"
              components={{
                noAdvice: <Link to="/no-financial-advice" />,
                terms: <Link to="/terms-of-service" />,
                privacy: <Link to="/privacy-policy" /> }}
            />
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default FinancialDisclaimer;
