import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { monthlyForGoal, monthsToGoal, savingsBalance } from "@garzoni/core";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { GlassButton, GlassCard, TextInput } from "components/ui";
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
 * Public savings goal calculator at /calculators/savings-goal and its /ro twin:
 * either the monthly amount that reaches a goal by a deadline, or how long a
 * monthly amount takes to get there.
 */
const PATH = "/calculators/savings-goal";

const DEFAULTS = {
  en: { goal: "5000", start: "500", months: "24", monthly: "200", rate: "4" },
  ro: { goal: "20000", start: "2000", months: "24", monthly: "800", rate: "5" },
} as const;

type Mode = "monthly" | "time";
type Field = "goal" | "start" | "months" | "monthly" | "rate";

type Outcome =
  | { kind: "invalid" }
  | { kind: "reached" }
  | { kind: "unreachable" }
  | {
      kind: "plan";
      months: number;
      monthly: number;
      start: number;
      deposits: number;
      interest: number;
    };

export default function SavingsGoalPage() {
  const { lang, t, to, url, shareImage } = usePublicLocale();
  const [mode, setMode] = useState<Mode>("monthly");
  const [values, setValues] = useState<Record<Field, string>>({
    ...DEFAULTS[lang],
  });
  const markUsed = useCalculatorUsed("savings_goal", lang);
  const money = moneyFormatter(lang);

  const outcome = useMemo<Outcome>(() => {
    const goal = Number(values.goal);
    const start = Number(values.start);
    const rate = Number(values.rate);
    const base =
      [goal, start, rate].every(Number.isFinite) &&
      goal > 0 &&
      start >= 0 &&
      rate >= 0 &&
      rate <= 30;
    if (!base) return { kind: "invalid" };

    let months: number;
    let monthly: number;
    if (mode === "monthly") {
      months = Number(values.months);
      if (!Number.isInteger(months) || months < 1 || months > 600) {
        return { kind: "invalid" };
      }
      if (start >= goal) return { kind: "reached" };
      // Rounded up to the pound/leu so the plan never falls just short.
      monthly = Math.ceil(monthlyForGoal(goal, start, months, rate));
    } else {
      monthly = Number(values.monthly);
      if (!Number.isFinite(monthly) || monthly < 0) return { kind: "invalid" };
      const needed = monthsToGoal(goal, start, monthly, rate);
      if (needed === 0) return { kind: "reached" };
      if (needed === null) return { kind: "unreachable" };
      months = needed;
    }
    const balance = savingsBalance(start, monthly, months, rate);
    const deposits = monthly * months;
    return {
      kind: "plan",
      months,
      monthly,
      start,
      deposits,
      interest: Math.max(balance - start - deposits, 0),
    };
  }, [mode, values]);

  const update = (field: Field) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    markUsed();
  };

  // The plural form is picked here: the app's i18next runs compatibilityJSON v3,
  // which doesn't resolve _one/_few/_other suffixes from `count`.
  const plural = new Intl.PluralRules(lang);
  const unit = (name: "years" | "months", n: number) =>
    t(`calculators.savingsGoal.duration.${name}_${plural.select(n)}`, { n });

  const duration = (months: number) => {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const y = unit("years", years);
    const m = unit("months", rest);
    if (!years) return m;
    if (!rest) return y;
    return t("calculators.savingsGoal.duration.both", { years: y, months: m });
  };

  const goalLabel = money(Number(values.goal));
  const canonical = url(PATH);
  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`calculators.savingsGoal.faq.q${n}`),
    answer: t(`calculators.savingsGoal.faq.a${n}`),
  }));

  return (
    <PageContainer maxWidth="4xl">
      <SeoHead
        title={t("calculators.savingsGoal.seoTitle")}
        description={t("calculators.savingsGoal.seoDescription")}
        canonical={canonical}
        image={shareImage(PATH)}
        imageAlt={`${t("shareImage.kicker.calculator")}: ${t("calculators.savingsGoal.title")}`}
        locale={lang}
        alternates={calculatorAlternates(PATH)}
        breadcrumbs={[
          {
            name: t("calculators.breadcrumbs.home"),
            url: `${SITE_URL}/`,
          },
          { name: t("calculators.savingsGoal.title"), url: canonical },
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
          {t("calculators.savingsGoal.title")}
        </h1>
        <p className="text-lg leading-relaxed text-content-primary">
          {t("calculators.savingsGoal.intro")}
        </p>
      </header>

      <GlassCard padding="lg">
        <div className="flex flex-col gap-6">
          <div
            role="group"
            aria-label={t("calculators.savingsGoal.mode.label")}
            className="flex flex-wrap gap-2"
          >
            {(["monthly", "time"] as const).map((m) => (
              <GlassButton
                key={m}
                variant={mode === m ? "active" : "ghost"}
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  markUsed();
                }}
              >
                {t(`calculators.savingsGoal.mode.${m}`)}
              </GlassButton>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <TextInput
                id="sg-goal"
                type="number"
                label={t("calculators.savingsGoal.inputs.goal")}
                value={values.goal}
                onChange={update("goal")}
              />
              <TextInput
                id="sg-start"
                type="number"
                label={t("calculators.savingsGoal.inputs.start")}
                value={values.start}
                onChange={update("start")}
              />
              {mode === "monthly" ? (
                <TextInput
                  id="sg-months"
                  type="number"
                  label={t("calculators.savingsGoal.inputs.months")}
                  value={values.months}
                  onChange={update("months")}
                />
              ) : (
                <TextInput
                  id="sg-monthly"
                  type="number"
                  label={t("calculators.savingsGoal.inputs.monthly")}
                  value={values.monthly}
                  onChange={update("monthly")}
                />
              )}
              <TextInput
                id="sg-rate"
                type="number"
                label={t("calculators.savingsGoal.inputs.rate")}
                helperText={t("calculators.savingsGoal.inputs.rateHelp")}
                value={values.rate}
                onChange={update("rate")}
              />
            </div>

            <div aria-live="polite" className="flex flex-col gap-4">
              {outcome.kind === "plan" && (
                <>
                  <h2 className="text-lg font-semibold text-content-primary">
                    {mode === "monthly"
                      ? t("calculators.savingsGoal.results.monthlyHeading", {
                          goal: goalLabel,
                          duration: duration(outcome.months),
                        })
                      : t("calculators.savingsGoal.results.timeHeading", {
                          monthly: money(outcome.monthly),
                        })}
                  </h2>
                  <dl className="flex flex-col gap-3">
                    <div>
                      <dt className="text-sm text-content-muted">
                        {mode === "monthly"
                          ? t("calculators.savingsGoal.results.monthly")
                          : t("calculators.savingsGoal.results.time", {
                              goal: goalLabel,
                            })}
                      </dt>
                      <dd className="text-3xl font-bold text-content-primary">
                        {mode === "monthly"
                          ? money(outcome.monthly)
                          : duration(outcome.months)}
                      </dd>
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <dt className="text-sm text-content-muted">
                          {t("calculators.savingsGoal.results.contributed")}
                        </dt>
                        <dd className="text-lg font-semibold text-content-primary">
                          {money(outcome.start + outcome.deposits)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-content-muted">
                          {t("calculators.savingsGoal.results.interest")}
                        </dt>
                        <dd className="text-lg font-semibold text-content-primary">
                          {money(outcome.interest)}
                        </dd>
                      </div>
                    </div>
                  </dl>
                  <StackedBar
                    segments={[
                      {
                        label: t("calculators.savingsGoal.results.barStart"),
                        value: outcome.start,
                        className: "bg-state-info",
                      },
                      {
                        label: t("calculators.savingsGoal.results.barDeposits"),
                        value: outcome.deposits,
                        className: "bg-brand-primary",
                      },
                      {
                        label: t("calculators.savingsGoal.results.barInterest"),
                        value: outcome.interest,
                        className: "bg-brand-accent",
                      },
                    ]}
                  />
                </>
              )}
              {outcome.kind === "reached" && (
                <p className="text-content-primary">
                  {t("calculators.savingsGoal.results.reached")}
                </p>
              )}
              {outcome.kind === "unreachable" && (
                <p className="text-sm text-state-warning">
                  {t("calculators.savingsGoal.results.unreachable")}
                </p>
              )}
              {outcome.kind === "invalid" && (
                <p className="text-sm text-state-error">
                  {t("calculators.savingsGoal.invalid")}
                </p>
              )}
              <p className="text-xs text-content-muted">
                {t("calculators.savingsGoal.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      <Section heading={t("calculators.savingsGoal.how.heading")}>
        <p>{t("calculators.savingsGoal.how.p1")}</p>
        <p>{t("calculators.savingsGoal.how.p2")}</p>
      </Section>

      <Section heading={t("calculators.savingsGoal.example.heading")}>
        <p>{t("calculators.savingsGoal.example.body")}</p>
      </Section>

      <Section heading={t("calculators.savingsGoal.tips.heading")}>
        <p>{t("calculators.savingsGoal.tips.body")}</p>
      </Section>

      <Section heading={t("calculators.savingsGoal.caveats.heading")}>
        <p>{t("calculators.savingsGoal.caveats.body")}</p>
      </Section>

      <Section heading={t("calculators.savingsGoal.learn.heading")}>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>
            <Link
              to={to("/learn/short-term-vs-long-term-goals")}
              className={linkClass}
            >
              {t("calculators.savingsGoal.learn.goals")}
            </Link>
          </li>
          <li>
            <Link
              to={to("/learn/where-to-keep-your-emergency-fund")}
              className={linkClass}
            >
              {t("calculators.savingsGoal.learn.emergency")}
            </Link>
          </li>
        </ul>
      </Section>

      <RelatedCalculators current="savingsGoal" />

      <Section heading={t("calculators.savingsGoal.faqHeading")}>
        {faqItems.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <h3 className="font-semibold">{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </Section>

      <CalculatorCta
        heading={t("calculators.savingsGoal.cta.heading")}
        body={t("calculators.savingsGoal.cta.body")}
        button={t("calculators.savingsGoal.cta.button")}
        appStore={t("calculators.savingsGoal.cta.appStore")}
        googlePlay={t("calculators.savingsGoal.cta.googlePlay")}
        placement="calculator_savings_goal"
      />
    </PageContainer>
  );
}
