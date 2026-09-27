import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FOUNDER_AUTHOR } from "@garzoni/core";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { formatEditorialDate } from "components/editorial/Byline";

// Bump when the policy text below changes materially.
const POLICY_UPDATED = "2026-09-27";
const CANONICAL = "https://www.garzoni.app/editorial-standards";

const SOURCES = [
  {
    key: "moneyHelper",
    name: "MoneyHelper",
    url: "https://www.moneyhelper.org.uk/",
  },
  {
    key: "fca",
    name: "Financial Conduct Authority (FCA)",
    url: "https://www.fca.org.uk/",
  },
  { key: "gov", name: "HMRC and GOV.UK", url: "https://www.gov.uk/" },
  {
    key: "boe",
    name: "Bank of England",
    url: "https://www.bankofengland.co.uk/",
  },
  {
    key: "ons",
    name: "Office for National Statistics (ONS)",
    url: "https://www.ons.gov.uk/",
  },
] as const;

const WRITING_KEYS = ["clarity", "context", "education"] as const;

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 leading-relaxed text-content-primary">
      <h2 className="text-xl font-semibold">{heading}</h2>
      {children}
    </section>
  );
}

const linkClass = "text-brand-primary hover:underline";

export default function EditorialStandardsPage() {
  const { t, i18n } = useTranslation();

  return (
    <PageContainer maxWidth="4xl">
      <SeoHead
        title={t("editorial.standards.seoTitle")}
        description={t("editorial.standards.seoDescription")}
        canonical={CANONICAL}
        breadcrumbs={[
          {
            name: t("editorial.breadcrumbs.home"),
            url: "https://www.garzoni.app/",
          },
          {
            name: t("editorial.breadcrumbs.about"),
            url: "https://www.garzoni.app/about",
          },
          { name: t("editorial.breadcrumbs.standards"), url: CANONICAL },
        ]}
      />

      <Breadcrumbs
        items={[
          { label: t("editorial.breadcrumbs.home"), to: "/" },
          { label: t("editorial.breadcrumbs.about"), to: "/about" },
          { label: t("editorial.breadcrumbs.standards") },
        ]}
      />

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-content-primary">
          {t("editorial.standards.title")}
        </h1>
        <p className="text-sm text-content-muted">
          <time dateTime={POLICY_UPDATED}>
            {t("editorial.standards.lastUpdated", {
              date: formatEditorialDate(
                `${POLICY_UPDATED}T12:00:00Z`,
                i18n.language
              ),
            })}
          </time>
        </p>
      </header>

      <p className="text-lg leading-relaxed text-content-primary">
        {t("editorial.standards.intro")}
      </p>

      <Section heading={t("editorial.standards.who.heading")}>
        <p>{t("editorial.standards.who.body")}</p>
        <p>{t("editorial.standards.who.review")}</p>
        <Link to={FOUNDER_AUTHOR.path} rel="author" className={linkClass}>
          {t("editorial.standards.authorLink")} →
        </Link>
      </Section>

      <Section heading={t("editorial.standards.writing.heading")}>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          {WRITING_KEYS.map((key) => (
            <li key={key}>{t(`editorial.standards.writing.${key}`)}</li>
          ))}
        </ul>
      </Section>

      <Section heading={t("editorial.standards.sources.heading")}>
        <p>{t("editorial.standards.sources.intro")}</p>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          {SOURCES.map((source) => (
            <li key={source.key}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {source.name}
              </a>
              {" — "}
              {t(`editorial.standards.sources.${source.key}`)}
            </li>
          ))}
        </ul>
        <p>{t("editorial.standards.sources.outro")}</p>
      </Section>

      <Section heading={t("editorial.standards.updates.heading")}>
        <p>{t("editorial.standards.updates.body")}</p>
      </Section>

      <Section heading={t("editorial.standards.corrections.heading")}>
        <p>{t("editorial.standards.corrections.body")}</p>
        <Link to="/support" className={linkClass}>
          {t("editorial.standards.corrections.link")} →
        </Link>
      </Section>

      <Section heading={t("editorial.standards.advice.heading")}>
        <p>{t("editorial.standards.advice.body")}</p>
        <p>{t("editorial.standards.advice.help")}</p>
        <Link to="/financial-disclaimer" className={linkClass}>
          {t("editorial.standards.advice.link")} →
        </Link>
      </Section>
    </PageContainer>
  );
}
