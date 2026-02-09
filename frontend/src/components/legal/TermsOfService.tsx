import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const TermsOfService = () => {
  const { t } = useTranslation();
  return (
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>
            {t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("legal.terms.title")}
          </h1>
        </header>

        <div className={contentClass}>
          <h2>{t("legal.terms.sections.agreement.title")}</h2>
          <p>
            <Trans
              i18nKey="legal.terms.sections.agreement.body"
              components={{
                privacy: <Link to="/privacy-policy" />,
                cookie: <Link to="/cookie-policy" /> }}
            />
          </p>

          <h2>{t("legal.terms.sections.about.title")}</h2>
          <p>{t("legal.terms.sections.about.body1")}</p>
          <p>
            <Trans
              i18nKey="legal.terms.sections.about.body2"
              components={{
                financial: <Link to="/financial-disclaimer" />,
                noAdvice: <Link to="/no-financial-advice" /> }}
            />
          </p>

          <h2>{t("legal.terms.sections.security.title")}</h2>
          <p>{t("legal.terms.sections.security.body")}</p>

          <h2>{t("legal.terms.sections.acceptableUse.title")}</h2>
          <p>{t("legal.terms.sections.acceptableUse.body")}</p>
          <ul>
            <li>{t("legal.terms.sections.acceptableUse.items.unlawful")}</li>
            <li>{t("legal.terms.sections.acceptableUse.items.unauthorized")}</li>
            <li>{t("legal.terms.sections.acceptableUse.items.interfere")}</li>
            <li>{t("legal.terms.sections.acceptableUse.items.reverse")}</li>
          </ul>

          <h2>{t("legal.terms.sections.educational.title")}</h2>
          <p>{t("legal.terms.sections.educational.body")}</p>

          <h2>{t("legal.terms.sections.subscriptions.title")}</h2>
          <p>{t("legal.terms.sections.subscriptions.body")}</p>

          <h2>{t("legal.terms.sections.thirdParty.title")}</h2>
          <p>{t("legal.terms.sections.thirdParty.body")}</p>

          <h2>{t("legal.terms.sections.ip.title")}</h2>
          <p>{t("legal.terms.sections.ip.body")}</p>

          <h2>{t("legal.terms.sections.disclaimers.title")}</h2>
          <p>{t("legal.terms.sections.disclaimers.body")}</p>

          <h2>{t("legal.terms.sections.liability.title")}</h2>
          <p>{t("legal.terms.sections.liability.body")}</p>

          <h2>{t("legal.terms.sections.indemnity.title")}</h2>
          <p>{t("legal.terms.sections.indemnity.body")}</p>

          <h2>{t("legal.terms.sections.termination.title")}</h2>
          <p>{t("legal.terms.sections.termination.body")}</p>

          <h2>{t("legal.terms.sections.changes.title")}</h2>
          <p>{t("legal.terms.sections.changes.body")}</p>

          <h2>{t("legal.terms.sections.law.title")}</h2>
          <p>{t("legal.terms.sections.law.body")}</p>

          <h2>{t("legal.terms.sections.contact.title")}</h2>
          <p>
            {t("legal.terms.sections.contact.body")}{" "}
            <a href="mailto:monevo.educational@gmail.com">
              monevo.educational@gmail.com
            </a>
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default TermsOfService;
