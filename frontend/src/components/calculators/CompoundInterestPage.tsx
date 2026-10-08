import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { GlassCard, TextInput } from "components/ui";
import { SITE_URL, usePublicLocale } from "components/seo/publicLocale";
import { balanceWithStart } from "components/landing/home/compound";
import {
  CalculatorCta,
  RelatedCalculators,
  Section,
  calculatorAlternates,
  linkClass,
  moneyFormatter,
  useCalculatorUsed,
} from "./CalculatorParts";

/**
 * Public compound interest calculator at /calculators/compound-interest and its
 * /ro twin. No login: it is the search-facing version of the savings tools, and
 * every result leads into the matching free lesson and signup.
 */
const PATH = "/calculators/compound-interest";

const LOCALE_SETUP = {
  en: {
    defaults: { start: "1000", monthly: "150", rate: "5", years: "20" },
    relatedLesson: "how-interest-works-apr-vs-aer",
  },
  ro: {
    defaults: { start: "5000", monthly: "500", rate: "5", years: "20" },
    relatedLesson: "how-much-to-save",
  },
} as const;

type Field = "start" | "monthly" | "rate" | "years";

export default function CompoundInterestPage() {
  const { lang, t, to, url } = usePublicLocale();
  const setup = LOCALE_SETUP[lang];
  const [values, setValues] = useState<Record<Field, string>>({
    ...setup.defaults,
  });
  const markUsed = useCalculatorUsed("compound_interest", lang);

  const result = useMemo(() => {
    const start = Number(values.start);
    const monthly = Number(values.monthly);
    const rate = Number(values.rate);
    const years = Number(values.years);
    const valid =
      [start, monthly, rate, years].every(Number.isFinite) &&
      start >= 0 &&
      monthly >= 0 &&
      rate >= 0 &&
      rate <= 30 &&
      Number.isInteger(years) &&
      years >= 1 &&
      years <= 60;
    if (!valid) return null;
    const balance = balanceWithStart(start, monthly, years, rate);
    const contributed = start + monthly * 12 * years;
    const interest = Math.max(balance - contributed, 0);
    return {
      years,
      balance,
      contributed,
      interest,
      interestShare: balance > 0 ? interest / balance : 0,
    };
  }, [values]);

  const update = (field: Field) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    markUsed();
  };

  const money = moneyFormatter(lang);

  const canonical = url(PATH);
  const faqItems = [1, 2, 3].map((n) => ({
    question: t(`calculators.compound.faq.q${n}`),
    answer: t(`calculators.compound.faq.a${n}`),
  }));

  return (
    <PageContainer maxWidth="4xl">
      <SeoHead
        title={t("calculators.compound.seoTitle")}
        description={t("calculators.compound.seoDescription")}
        canonical={canonical}
        locale={lang}
        alternates={calculatorAlternates(PATH)}
        breadcrumbs={[
          {
            name: t("calculators.breadcrumbs.home"),
            url: `${SITE_URL}/`,
          },
          { name: t("calculators.compound.title"), url: canonical },
        ]}
        faqItems={faqItems}
      />

      <Breadcrumbs
        items={[
          { label: t("calculators.breadcrumbs.home"), to: "/" },
          { label: t("calculators.breadcrumbs.calculators") },
        ]}
      />

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-content-primary">
          {t("calculators.compound.title")}
        </h1>
        <p className="text-lg leading-relaxed text-content-primary">
          {t("calculators.compound.intro")}
        </p>
      </header>

      <GlassCard padding="lg">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <TextInput
              id="ci-start"
              type="number"
              label={t("calculators.compound.inputs.start")}
              value={values.start}
              onChange={update("start")}
            />
            <TextInput
              id="ci-monthly"
              type="number"
              label={t("calculators.compound.inputs.monthly")}
              value={values.monthly}
              onChange={update("monthly")}
            />
            <TextInput
              id="ci-rate"
              type="number"
              label={t("calculators.compound.inputs.rate")}
              helperText={t("calculators.compound.inputs.rateHelp")}
              value={values.rate}
              onChange={update("rate")}
            />
            <TextInput
              id="ci-years"
              type="number"
              label={t("calculators.compound.inputs.years")}
              value={values.years}
              onChange={update("years")}
            />
          </div>

          <div aria-live="polite" className="flex flex-col gap-4">
            {result ? (
              <>
                <h2 className="text-lg font-semibold text-content-primary">
                  {t("calculators.compound.results.heading", {
                    years: result.years,
                  })}
                </h2>
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt className="text-sm text-content-muted">
                      {t("calculators.compound.results.balance")}
                    </dt>
                    <dd className="text-3xl font-bold text-content-primary">
                      {money(result.balance)}
                    </dd>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <dt className="text-sm text-content-muted">
                        {t("calculators.compound.results.contributed")}
                      </dt>
                      <dd className="text-lg font-semibold text-content-primary">
                        {money(result.contributed)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-content-muted">
                        {t("calculators.compound.results.interest")}
                      </dt>
                      <dd className="text-lg font-semibold text-content-primary">
                        {money(result.interest)}
                      </dd>
                    </div>
                  </div>
                </dl>
                <div
                  className="flex h-3 w-full overflow-hidden rounded-full bg-surface-elevated"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-brand-primary"
                    style={{ width: `${result.interestShare * 100}%` }}
                  />
                </div>
                <p className="text-sm text-content-muted">
                  {t("calculators.compound.results.share", {
                    percent: Math.round(result.interestShare * 100),
                  })}
                </p>
              </>
            ) : (
              <p className="text-sm text-state-error">
                {t("calculators.compound.invalid")}
              </p>
            )}
            <p className="text-xs text-content-muted">
              {t("calculators.compound.disclaimer")}
            </p>
          </div>
        </div>
      </GlassCard>

      <Section heading={t("calculators.compound.how.heading")}>
        <p>{t("calculators.compound.how.p1")}</p>
        <p>{t("calculators.compound.how.p2")}</p>
        <p className="text-content-muted">
          {t("calculators.compound.how.formula")}
        </p>
      </Section>

      <Section heading={t("calculators.compound.example.heading")}>
        <p>{t("calculators.compound.example.body")}</p>
      </Section>

      <Section heading={t("calculators.compound.caveats.heading")}>
        <p>{t("calculators.compound.caveats.body")}</p>
      </Section>

      <Section heading={t("calculators.compound.learn.heading")}>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>
            <Link
              to={to("/learn/how-compound-interest-works")}
              className={linkClass}
            >
              {t("calculators.compound.learn.compound")}
            </Link>
          </li>
          <li>
            <Link
              to={to(`/learn/${setup.relatedLesson}`)}
              className={linkClass}
            >
              {t("calculators.compound.learn.related")}
            </Link>
          </li>
        </ul>
      </Section>

      <RelatedCalculators current="compound" />

      <Section heading={t("calculators.compound.faqHeading")}>
        {faqItems.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <h3 className="font-semibold">{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </Section>

      <CalculatorCta
        heading={t("calculators.compound.cta.heading")}
        body={t("calculators.compound.cta.body")}
        button={t("calculators.compound.cta.button")}
        appStore={t("calculators.compound.cta.appStore")}
        googlePlay={t("calculators.compound.cta.googlePlay")}
        placement="calculator_compound"
      />
    </PageContainer>
  );
}
