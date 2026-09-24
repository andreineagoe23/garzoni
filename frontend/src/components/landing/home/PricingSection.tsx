import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { GlassButton, GlassCard } from "components/ui";
import { money } from "./format";
import { type TierPricing, useLandingPricing } from "./useLandingPricing";

type Billing = "annual" | "monthly";

const PLAN_FEATURES = {
  starter: ["basicFinance", "streaks", "calculators"],
  plus: ["path", "calculators", "insights"],
  pro: ["everythingPlus", "simulations", "priorityAi", "earlyAccess"],
} as const;

function PlanCard({
  plan,
  price,
  per,
  note,
  cta,
  variant,
  onChoose,
}: {
  plan: keyof typeof PLAN_FEATURES;
  price: string;
  per: string;
  note: string;
  cta: string;
  variant: "ghost" | "active" | "primary";
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const pro = plan === "pro";
  const name = t(`welcome.pricing.${plan}.name`);

  return (
    <GlassCard padding="lg" className="h-full">
      <div className="gzh-plan">
        {pro ? (
          <div className="gzh-plan__name-row">
            <span className="gzh-plan__name gzh-plan__name--pro">{name}</span>
            <span className="gzh-plan__badge">
              {t("welcome.pricing.pro.badge")}
            </span>
          </div>
        ) : (
          <span className="gzh-plan__name">{name}</span>
        )}
        <div className="gzh-plan__price-block">
          <div className="gzh-plan__price-row">
            <span className="gzh-plan__price">{price}</span>
            <span className="gzh-plan__per">{per}</span>
          </div>
          <span className="gzh-plan__note">{note}</span>
        </div>
        <ul className="gzh-plan__features">
          {PLAN_FEATURES[plan].map((feature) => (
            <li key={feature} className="gzh-plan__feature">
              <span
                className={`gzh-plan__check${pro ? " gzh-plan__check--gold" : ""}`}
                aria-hidden="true"
              >
                ✓
              </span>
              {t(`welcome.pricing.${plan}.features.${feature}`)}
            </li>
          ))}
        </ul>
        <div className="gzh-plan__cta">
          <GlassButton
            variant={variant}
            size="lg"
            className="w-full"
            onClick={onChoose}
          >
            {cta}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}

export default function PricingSection({
  onChoosePlan,
}: {
  onChoosePlan: () => void;
}) {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing>("annual");
  const pricing = useLandingPricing();
  const annual = billing === "annual";

  const paidTier = (tier: TierPricing) => ({
    price: money(annual ? tier.yearly / 12 : tier.monthly, 2, tier.currency),
    note: annual
      ? t("welcome.pricing.billedYearly", {
          price: money(tier.yearly, 2, tier.currency),
          pct: tier.savingsPct,
        })
      : t("welcome.pricing.billedMonthly"),
  });
  const plus = paidTier(pricing.plus);
  const pro = paidTier(pricing.pro);
  const per = t("welcome.pricing.perMonth");

  return (
    <section id="pricing" className="gzh-section">
      <div className="gzh-container gzh-pricing__inner">
        <div className="gzh-pricing__head gzh-rise">
          <h2 className="gzh-h2 gzh-h2--section">
            <Trans
              i18nKey="welcome.pricing.title"
              components={{
                accent: <span key="accent" className="gzh-accent" />,
              }}
            />
          </h2>
          <p className="gzh-sub">
            {t("welcome.pricing.body", {
              pct: Math.max(pricing.plus.savingsPct, pricing.pro.savingsPct),
            })}
          </p>
          <div
            className="gzh-toggle"
            role="group"
            aria-label={t("welcome.pricing.billingLabel")}
          >
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="gzh-toggle__btn"
                aria-pressed={billing === option}
                onClick={() => setBilling(option)}
              >
                {t(`welcome.pricing.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="gzh-plans gzh-rise gzh-rise--25">
          <PlanCard
            plan="starter"
            price={money(0, 0, pricing.plus.currency)}
            per={t("welcome.pricing.starter.forever")}
            note={t("welcome.pricing.starter.note")}
            cta={t("welcome.pricing.starter.cta")}
            variant="ghost"
            onChoose={onChoosePlan}
          />
          <PlanCard
            plan="plus"
            price={plus.price}
            per={per}
            note={plus.note}
            cta={t("welcome.pricing.plus.cta")}
            variant="active"
            onChoose={onChoosePlan}
          />
          <div className="gzh-plan-ring">
            <PlanCard
              plan="pro"
              price={pro.price}
              per={per}
              note={pro.note}
              cta={t("welcome.pricing.pro.cta")}
              variant="primary"
              onChoose={onChoosePlan}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
