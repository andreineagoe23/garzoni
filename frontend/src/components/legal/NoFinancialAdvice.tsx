import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const NoFinancialAdvice = () => {
  const { t } = useTranslation();
  return (
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>
            {t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("legal.noAdvice.title")}
          </h1>
        </header>

        <div className={contentClass}>
          <p>
            <strong>{t("legal.noAdvice.intro")}</strong>
          </p>

          <h2>{t("legal.noAdvice.sections.regulatory.title")}</h2>
          <ul>
            <li>{t("legal.noAdvice.sections.regulatory.items.position")}</li>
            <li>{t("legal.noAdvice.sections.regulatory.items.fca")}</li>
            <li>{t("legal.noAdvice.sections.regulatory.items.noAdvisor")}</li>
            <li>{t("legal.noAdvice.sections.regulatory.items.noRelationship")}</li>
          </ul>

          <h2>{t("legal.noAdvice.sections.infer.title")}</h2>
          <ul>
            <li>{t("legal.noAdvice.sections.infer.items.outputs")}</li>
            <li>{t("legal.noAdvice.sections.infer.items.workflows")}</li>
            <li>{t("legal.noAdvice.sections.infer.items.labels")}</li>
          </ul>

          <h2>{t("legal.noAdvice.sections.professional.title")}</h2>
          <p>{t("legal.noAdvice.sections.professional.body")}</p>

          <h2>{t("legal.noAdvice.sections.related.title")}</h2>
          <p>
            <Trans
              i18nKey="legal.noAdvice.sections.related.body"
              components={{
                financial: <Link to="/financial-disclaimer" />,
                terms: <Link to="/terms-of-service" />,
                privacy: <Link to="/privacy-policy" /> }}
            />
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default NoFinancialAdvice;
