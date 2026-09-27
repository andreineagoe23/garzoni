import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EDITORIAL_STANDARDS_PATH, FOUNDER_AUTHOR } from "@garzoni/core";
import Header from "components/layout/Header";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { GlassCard } from "components/ui";

const FAQ_KEYS = ["what", "different", "who", "advice"] as const;
const HOW_KEYS = ["lessons", "repetition", "coach", "streaks"] as const;

const linkClass = "text-brand-primary hover:underline";

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

export default function AboutPage() {
  const { t } = useTranslation();
  const faqItems = FAQ_KEYS.map((key) => ({
    question: t(`editorial.about.faq.${key}Q`),
    answer: t(`editorial.about.faq.${key}A`),
  }));

  return (
    <>
      <SeoHead
        title={t("editorial.about.seoTitle")}
        description={t("editorial.about.seoDescription")}
        canonical="https://www.garzoni.app/about"
        breadcrumbs={[
          {
            name: t("editorial.breadcrumbs.home"),
            url: "https://www.garzoni.app/",
          },
          {
            name: t("editorial.breadcrumbs.about"),
            url: "https://www.garzoni.app/about",
          },
        ]}
        faqItems={faqItems}
      />
      <Header />

      <PageContainer maxWidth="4xl">
        <Breadcrumbs
          items={[
            { label: t("editorial.breadcrumbs.home"), to: "/" },
            { label: t("editorial.breadcrumbs.about") },
          ]}
        />

        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-content-primary">
            {t("editorial.about.title")}
          </h1>
          <p className="text-lg leading-relaxed text-content-primary">
            {t("editorial.about.intro")}
          </p>
        </header>

        <Section heading={t("editorial.about.missionHeading")}>
          <p>{t("editorial.about.missionBody")}</p>
        </Section>

        <Section heading={t("editorial.about.founderHeading")}>
          <p>{t("editorial.about.founderBody")}</p>
          <p className="text-content-muted">
            {t("editorial.about.founderDisclaimer")}
          </p>
          <Link to={FOUNDER_AUTHOR.path} rel="author" className={linkClass}>
            {t("editorial.about.founderLink")} →
          </Link>
        </Section>

        <Section heading={t("editorial.about.standardsHeading")}>
          <p>{t("editorial.about.standardsBody")}</p>
          <Link to={EDITORIAL_STANDARDS_PATH} className={linkClass}>
            {t("editorial.about.standardsLink")} →
          </Link>
        </Section>

        <Section heading={t("editorial.about.howHeading")}>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            {HOW_KEYS.map((key) => (
              <li key={key}>
                <strong>{t(`editorial.about.how.${key}Title`)}</strong>{" "}
                {t(`editorial.about.how.${key}Body`)}
              </li>
            ))}
          </ul>
        </Section>

        <Section heading={t("editorial.about.learnHeading")}>
          <p>{t("editorial.about.learnBody")}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/learn" className={linkClass}>
              {t("editorial.about.browseLessons")}
            </Link>
            <Link to="/guides" className={linkClass}>
              {t("editorial.about.browseGuides")}
            </Link>
            <Link to="/marketing" className={linkClass}>
              {t("editorial.about.seeFeatures")}
            </Link>
            <Link to="/subscriptions" className={linkClass}>
              {t("editorial.about.viewPricing")}
            </Link>
          </p>
        </Section>

        <GlassCard padding="lg" hover={false}>
          <div className="flex flex-col gap-4 text-content-primary">
            <h2 className="text-xl font-semibold">
              {t("editorial.about.ctaHeading")}
            </h2>
            <p>{t("editorial.about.ctaBody")}</p>
            <Link
              to="/register"
              className="self-start rounded-lg bg-brand-primary px-6 py-3 font-semibold text-content-on-primary no-underline transition hover:bg-brand-primary-hover"
            >
              {t("editorial.about.ctaButton")}
            </Link>
          </div>
        </GlassCard>
      </PageContainer>
    </>
  );
}
