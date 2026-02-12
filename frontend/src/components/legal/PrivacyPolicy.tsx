import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  return (
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>
            {t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("legal.privacy.title")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("legal.privacy.intro")}
          </p>
        </header>

        <div className={contentClass}>
          <h2>{t("legal.privacy.sections.who.title")}</h2>
          <p>{t("legal.privacy.sections.who.body")}</p>

          <h2>{t("legal.privacy.sections.data.title")}</h2>
          <p>{t("legal.privacy.sections.data.intro")}</p>
          <ul>
            <li>
              <strong>{t("legal.privacy.sections.data.items.account.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.account.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.profile.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.profile.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.learning.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.learning.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.technical.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.technical.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.cookies.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.cookies.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.billing.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.billing.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.data.items.inputs.label")}</strong>{" "}
              {t("legal.privacy.sections.data.items.inputs.text")}
            </li>
          </ul>

          <h2>{t("legal.privacy.sections.collection.title")}</h2>
          <ul>
            <li>{t("legal.privacy.sections.collection.items.direct")}</li>
            <li>{t("legal.privacy.sections.collection.items.automatic")}</li>
            <li>{t("legal.privacy.sections.collection.items.processors")}</li>
          </ul>

          <h2>{t("legal.privacy.sections.purposes.title")}</h2>
          <ul>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.account.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.account.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.core.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.core.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.security.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.security.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.improve.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.improve.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.comms.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.comms.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.marketing.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.marketing.text")}
            </li>
            <li>
              <strong>{t("legal.privacy.sections.purposes.items.legal.label")}</strong>{" "}
              {t("legal.privacy.sections.purposes.items.legal.text")}
            </li>
          </ul>

          <h2>{t("legal.privacy.sections.cookies.title")}</h2>
          <p>{t("legal.privacy.sections.cookies.body1")}</p>
          <p>
            <Trans
              i18nKey="legal.privacy.sections.cookies.body2"
              components={{
                link: <Link to="/cookie-policy" /> }}
            />
          </p>

          <h2>{t("legal.privacy.sections.processors.title")}</h2>
          <p>{t("legal.privacy.sections.processors.body1")}</p>
          <ul>
            <li>{t("legal.privacy.sections.processors.items.stripe")}</li>
            <li>{t("legal.privacy.sections.processors.items.cookieConsent")}</li>
            <li>{t("legal.privacy.sections.processors.items.google")}</li>
            <li>{t("legal.privacy.sections.processors.items.amplitude")}</li>
            <li>{t("legal.privacy.sections.processors.items.sentry")}</li>
            <li>{t("legal.privacy.sections.processors.items.hosting")}</li>
            <li>{t("legal.privacy.sections.processors.items.email")}</li>
          </ul>
          <p>{t("legal.privacy.sections.processors.body2")}</p>

          <h2>{t("legal.privacy.sections.transfers.title")}</h2>
          <p>{t("legal.privacy.sections.transfers.body")}</p>

          <h2>{t("legal.privacy.sections.retention.title")}</h2>
          <p>{t("legal.privacy.sections.retention.body")}</p>

          <h2>{t("legal.privacy.sections.rights.title")}</h2>
          <p>{t("legal.privacy.sections.rights.body")}</p>
          <ul>
            <li>{t("legal.privacy.sections.rights.items.access")}</li>
            <li>{t("legal.privacy.sections.rights.items.correct")}</li>
            <li>{t("legal.privacy.sections.rights.items.delete")}</li>
            <li>{t("legal.privacy.sections.rights.items.restrict")}</li>
            <li>{t("legal.privacy.sections.rights.items.withdraw")}</li>
            <li>{t("legal.privacy.sections.rights.items.portable")}</li>
            <li>{t("legal.privacy.sections.rights.items.complaint")}</li>
          </ul>

          <h2>{t("legal.privacy.sections.security.title")}</h2>
          <p>{t("legal.privacy.sections.security.body")}</p>

          <h2>{t("legal.privacy.sections.children.title")}</h2>
          <p>{t("legal.privacy.sections.children.body")}</p>

          <h2>{t("legal.privacy.sections.changes.title")}</h2>
          <p>{t("legal.privacy.sections.changes.body")}</p>

          <h2>{t("legal.privacy.sections.contact.title")}</h2>
          <p>
            {t("legal.privacy.sections.contact.email")}{" "}
            <a href="mailto:monevo.educational@gmail.com">
              monevo.educational@gmail.com
            </a>
            <br />
            {t("legal.privacy.sections.contact.support")}{" "}
            <a href="mailto:monevo.educational@gmail.com">
              monevo.educational@gmail.com
            </a>
            <br />
            {t("legal.privacy.sections.contact.country")}
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default PrivacyPolicy;
