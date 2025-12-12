import React from "react";
import {
  Check2Circle,
  ShieldCheck,
  LightningCharge,
} from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import Header from "components/layout/Header";
import { GlassButton, GlassCard, GlassContainer } from "components/ui";

const plans = [
  {
    name: "Starter",
    price: "$0",
    cadence: "Forever free",
    description: "Try lessons, tools, and AI chat with daily limits.",
    highlight: false,
    badge: "Free",
    features: [
      "5 guided lessons per day",
      "Community challenges",
      "AI coach with limited replies",
      "Practice quizzes & streak tracking",
    ],
    cta: "Start for free",
  },
  {
    name: "Plus",
    price: "$12",
    cadence: "per month",
    description: "Level up with bigger quotas and priority support.",
    highlight: true,
    badge: "Most popular",
    features: [
      "Unlimited lessons & quizzes",
      "Priority AI coach responses",
      "Personalized learning paths",
      "Downloadable cheat-sheets",
    ],
    cta: "Upgrade to Plus",
  },
  {
    name: "Pro",
    price: "$24",
    cadence: "per month",
    description: "For power users who want everything unlocked.",
    highlight: false,
    badge: "Premium",
    features: [
      "Live cohort workshops",
      "1:1 expert feedback",
      "Advanced analytics & exports",
      "Unlimited AI strategy reviews",
    ],
    cta: "Go Pro",
  },
];

const comparisons = [
  {
    feature: "Daily lessons",
    starter: "5",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    feature: "AI coach replies",
    starter: "20 / day",
    plus: "200 / day",
    pro: "Unlimited",
  },
  {
    feature: "Personalized paths",
    starter: "Basic",
    plus: "Advanced",
    pro: "Advanced",
  },
  {
    feature: "Downloads",
    starter: "2 / week",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    feature: "Support",
    starter: "Community",
    plus: "Priority chat",
    pro: "Concierge",
  },
];

const faqs = [
  {
    question: "Can I stay on the free plan?",
    answer:
      "Yes! The Starter plan stays free forever with daily quotas so you can keep learning at your own pace.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Absolutely. You can upgrade or downgrade anytime and we will prorate the difference automatically.",
  },
  {
    question: "Do you offer team plans?",
    answer:
      "Yes, Pro includes cohort workshops and admin controls. Contact support for custom onboarding.",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "We use industry-standard encryption and PCI-compliant processors so your details stay protected.",
  },
];

function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="app-container min-h-screen flex flex-col bg-gradient-to-b from-[color:var(--bg-color,#f8fafc)] via-[color:var(--bg-color,#f8fafc)] to-[color:var(--bg-color,#eef2ff)] text-[color:var(--text-color,#111827)]">
      <Header />

      <main className="flex-1 pt-[90px]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 sm:px-6 lg:px-8">
          <section className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary,#1d5330)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)] shadow-inner shadow-[color:var(--primary,#1d5330)]/10">
              <ShieldCheck size={16} />
              Transparent pricing, no hidden fees
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-[color:var(--text-color,#0f172a)] sm:text-5xl">
              Choose the plan that grows with you
            </h1>
            <p className="mt-3 text-base text-[color:var(--muted-text,#6b7280)] sm:text-lg">
              Start free, upgrade when you need more AI coaching, downloads, and
              personalized support.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-[color:var(--muted-text,#6b7280)]">
              <div className="flex items-center gap-2 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-4 py-2 shadow-sm shadow-[color:var(--shadow-color,rgba(0,0,0,0.08))]">
                <Check2Circle className="text-[color:var(--primary,#1d5330)]" />
                Cancel anytime
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-4 py-2 shadow-sm shadow-[color:var(--shadow-color,rgba(0,0,0,0.08))]">
                <LightningCharge className="text-[color:var(--primary,#1d5330)]" />
                Instant upgrades
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <GlassCard
                key={plan.name}
                className={`relative overflow-hidden p-6 sm:p-8 ${
                  plan.highlight
                    ? "border-[color:var(--primary,#1d5330)] shadow-xl shadow-[color:var(--primary,#1d5330)]/30"
                    : ""
                }`}
              >
                {plan.highlight && (
                  <span className="absolute right-4 top-4 rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1 text-xs font-bold uppercase text-white shadow">
                    {plan.badge}
                  </span>
                )}
                {!plan.highlight && (
                  <span className="absolute right-4 top-4 rounded-full bg-[color:var(--input-bg,#f3f4f6)] px-3 py-1 text-xs font-semibold uppercase text-[color:var(--muted-text,#6b7280)]">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 text-4xl font-extrabold text-[color:var(--text-color,#0f172a)]">
                    {plan.price}
                    <span className="text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                      {plan.cadence}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    {plan.description}
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-[color:var(--text-color,#111827)]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check2Circle className="mt-0.5 text-[color:var(--primary,#1d5330)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <GlassButton
                  className="mt-8 w-full"
                  variant={plan.highlight ? "primary" : "ghost"}
                  onClick={() =>
                    navigate(plan.highlight ? "/register" : "/pricing")
                  }
                >
                  {plan.cta}
                </GlassButton>
              </GlassCard>
            ))}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[color:var(--primary,#1d5330)]/10 text-[color:var(--primary,#1d5330)] flex items-center justify-center">
                <ShieldCheck />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  Compare features
                </h2>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  See how each plan stacks up for your daily and weekly goals.
                </p>
              </div>
            </div>

            <GlassContainer className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Feature</th>
                      <th className="px-4 py-3 font-semibold">Starter</th>
                      <th className="px-4 py-3 font-semibold">Plus</th>
                      <th className="px-4 py-3 font-semibold">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-t border-[color:var(--border-color,#e5e7eb)]"
                      >
                        <td className="px-4 py-3 text-[color:var(--text-color,#111827)]">
                          {row.feature}
                        </td>
                        <td className="px-4 py-3">{row.starter}</td>
                        <td className="px-4 py-3 font-semibold text-[color:var(--primary,#1d5330)]">
                          {row.plus}
                        </td>
                        <td className="px-4 py-3">{row.pro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassContainer>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <GlassCard className="lg:col-span-1 p-6 sm:p-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary,#1d5330)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)]">
                  Need help choosing?
                </div>
                <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  Talk with a real human
                </h3>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  Tell us about your goals and we will recommend the right plan
                  for your timeline.
                </p>
                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate("/register")}
                >
                  Schedule a call
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/login")}
                >
                  I'm already a member
                </GlassButton>
              </div>
            </GlassCard>

            <GlassCard className="lg:col-span-2 p-6 sm:p-8 space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  Frequently asked questions
                </h3>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  Everything you need to know about billing and quotas.
                </p>
              </div>
              <div className="space-y-4">
                {faqs.map((item) => (
                  <div
                    key={item.question}
                    className="rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-3 shadow-sm"
                  >
                    <h4 className="text-base font-semibold text-[color:var(--text-color,#111827)]">
                      {item.question}
                    </h4>
                    <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Pricing;
