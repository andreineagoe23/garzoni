import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adjustBudget, splitBudget, type BudgetSplit } from "@garzoni/core";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { GlassCard, TextInput } from "components/ui";
import { SITE_URL, usePublicLocale } from "components/seo/publicLocale";
import {
  CalculatorCta,
  RelatedCalculators,
  Section,
  StackedBar,
  calculatorAlternates,
  linkClass,
  moneyFormatter,
  useCalculatorUsed,
} from "./CalculatorParts";

/**
 * Public 50/30/20 budget calculator at /calculators/50-30-20-budget and its /ro
 * twin. Splits take-home pay by the rule, then — if the reader says what their
 * essentials really cost — rebuilds the split around that number.
 */
const PATH = "/calculators/50-30-20-budget";

const DEFAULTS = {
  en: { income: "2200", essentials: "1200" },
  ro: { income: "5000", essentials: "2800" },
} as const;

type Field = "income" | "essentials";

const PARTS = [
  { key: "needs", className: "bg-brand-primary" },
  { key: "wants", className: "bg-brand-accent" },
  { key: "savings", className: "bg-state-info" },
] as const;

export default function BudgetRulePage() {
  const { lang, t, to, url } = usePublicLocale();
  const [values, setValues] = useState<Record<Field, string>>({
    ...DEFAULTS[lang],
  });
  const markUsed = useCalculatorUsed("budget_50_30_20", lang);
  const money = moneyFormatter(lang);

  const result = useMemo(() => {
    const income = Number(values.income);
    const hasEssentials = values.essentials.trim() !== "";
    const essentials = hasEssentials ? Number(values.essentials) : 0;
    const valid =
      Number.isFinite(income) &&
      income > 0 &&
      Number.isFinite(essentials) &&
      essentials >= 0;
    if (!valid) return null;
    const plan = hasEssentials ? adjustBudget(income, essentials) : null;
    return { income, split: splitBudget(income), plan };
  }, [values]);

  const update = (field: Field) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    markUsed();
  };

  const percent = (part: number) =>
    result ? Math.round((part / result.income) * 100) : 0;

  const verdict = (plan: BudgetSplit) => {
    const amounts = { wants: money(plan.wants), savings: money(plan.savings) };
    if (plan.needs <= result!.split.needs) {
      return t("calculators.budget.results.under", amounts);
    }
    if (plan.savings <= 0) return t("calculators.budget.results.noRoom");
    if (plan.savings < result!.split.savings) {
      return t("calculators.budget.results.overSavings", amounts);
    }
    return t("calculators.budget.results.overWants", amounts);
  };

  const canonical = url(PATH);
  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`calculators.budget.faq.q${n}`),
    answer: t(`calculators.budget.faq.a${n}`),
  }));

  return (
    <PageContainer maxWidth="4xl">
      <SeoHead
        title={t("calculators.budget.seoTitle")}
        description={t("calculators.budget.seoDescription")}
        canonical={canonical}
        locale={lang}
        alternates={calculatorAlternates(PATH)}
        breadcrumbs={[
          {
            name: t("calculators.breadcrumbs.home"),
            url: `${SITE_URL}/`,
          },
          { name: t("calculators.budget.title"), url: canonical },
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
          {t("calculators.budget.title")}
        </h1>
        <p className="text-lg leading-relaxed text-content-primary">
          {t("calculators.budget.intro")}
        </p>
      </header>

      <GlassCard padding="lg">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <TextInput
              id="br-income"
              type="number"
              label={t("calculators.budget.inputs.income")}
              helperText={t("calculators.budget.inputs.incomeHelp")}
              value={values.income}
              onChange={update("income")}
            />
            <TextInput
              id="br-essentials"
              type="number"
              label={t("calculators.budget.inputs.essentials")}
              helperText={t("calculators.budget.inputs.essentialsHelp")}
              value={values.essentials}
              onChange={update("essentials")}
            />
          </div>

          <div aria-live="polite" className="flex flex-col gap-4">
            {result ? (
              <>
                <h2 className="text-lg font-semibold text-content-primary">
                  {t("calculators.budget.results.heading")}
                </h2>
                <dl className="flex flex-col gap-3">
                  {PARTS.map(({ key }) => (
                    <div key={key}>
                      <dt className="text-sm text-content-muted">
                        {t(`calculators.budget.results.${key}`)}
                      </dt>
                      <dd className="text-2xl font-bold text-content-primary">
                        {money(result.split[key])}
                      </dd>
                      <dd className="text-xs text-content-muted">
                        {t(`calculators.budget.results.${key}Hint`)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <StackedBar
                  segments={PARTS.map(({ key, className }) => ({
                    label: t(`calculators.budget.labels.${key}`),
                    value: result.split[key],
                    className,
                  }))}
                />
              </>
            ) : (
              <p className="text-sm text-state-error">
                {t("calculators.budget.invalid")}
              </p>
            )}
            <p className="text-xs text-content-muted">
              {t("calculators.budget.disclaimer")}
            </p>
          </div>
        </div>

        {result?.plan && (
          <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="text-lg font-semibold text-content-primary">
              {t("calculators.budget.results.adjustedHeading")}
            </h2>
            <p className="text-content-primary">
              {t("calculators.budget.results.essentialsShare", {
                percent: percent(result.plan.needs),
              })}{" "}
              {verdict(result.plan)}
            </p>
            <dl className="grid grid-cols-3 gap-4">
              {PARTS.map(({ key }) => (
                <div key={key}>
                  <dt className="text-sm text-content-muted">
                    {t(`calculators.budget.labels.${key}`)}
                  </dt>
                  <dd className="text-lg font-semibold text-content-primary">
                    {money(result.plan![key])}
                  </dd>
                  <dd className="text-xs text-content-muted">
                    {percent(result.plan![key])}%
                  </dd>
                </div>
              ))}
            </dl>
            <StackedBar
              segments={PARTS.map(({ key, className }) => ({
                label: t(`calculators.budget.labels.${key}`),
                value: result.plan![key],
                className,
              }))}
            />
          </div>
        )}
      </GlassCard>

      <Section heading={t("calculators.budget.how.heading")}>
        <p>{t("calculators.budget.how.p1")}</p>
        <p>{t("calculators.budget.how.p2")}</p>
      </Section>

      <Section heading={t("calculators.budget.example.heading")}>
        <p>{t("calculators.budget.example.body")}</p>
      </Section>

      <Section heading={t("calculators.budget.caveats.heading")}>
        <p>{t("calculators.budget.caveats.body")}</p>
      </Section>

      <Section heading={t("calculators.budget.learn.heading")}>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>
            <Link
              to={to("/guides/how-to-start-budgeting")}
              className={linkClass}
            >
              {t("calculators.budget.learn.guide")}
            </Link>
          </li>
          <li>
            <Link
              to={to("/learn/fixed-vs-variable-expenses")}
              className={linkClass}
            >
              {t("calculators.budget.learn.expenses")}
            </Link>
          </li>
        </ul>
      </Section>

      <RelatedCalculators current="budget" />

      <Section heading={t("calculators.budget.faqHeading")}>
        {faqItems.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <h3 className="font-semibold">{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </Section>

      <CalculatorCta
        heading={t("calculators.budget.cta.heading")}
        body={t("calculators.budget.cta.body")}
        button={t("calculators.budget.cta.button")}
        appStore={t("calculators.budget.cta.appStore")}
        googlePlay={t("calculators.budget.cta.googlePlay")}
        placement="calculator_budget"
      />
    </PageContainer>
  );
}
