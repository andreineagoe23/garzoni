import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrency } from "@garzoni/core";
import { GlassButton, GlassCard } from "components/ui";
import {
  SITE_URL,
  type PublicLang,
  usePublicLocale,
} from "components/seo/publicLocale";
import { appStoreUrl, playStoreUrl } from "utils/storeLinks";

/**
 * Pieces shared by the public calculators (/calculators/* and their /ro twins):
 * section layout, the signup CTA, the links between calculators, and the
 * per-language currency setup. Each calculator page owns its own maths and copy.
 */

export const CALCULATORS = [
  { id: "compound", path: "/calculators/compound-interest" },
  { id: "savingsGoal", path: "/calculators/savings-goal" },
  { id: "budget", path: "/calculators/50-30-20-budget" },
] as const;

export type CalculatorId = (typeof CALCULATORS)[number]["id"];

// Romanian readers save in lei; the English pages are UK-first.
export const MONEY_LOCALE = {
  en: { currency: "GBP", numberLocale: "en-GB" },
  ro: { currency: "RON", numberLocale: "ro-RO" },
} as const;

export const linkClass = "text-brand-primary hover:underline";

export function moneyFormatter(lang: PublicLang) {
  const { currency, numberLocale } = MONEY_LOCALE[lang];
  return (amount: number) =>
    formatCurrency(amount, {
      currency,
      locale: numberLocale,
      maximumFractionDigits: 0,
    });
}

/** hreflang pair for a calculator path; both languages always exist. */
export function calculatorAlternates(path: string) {
  return [
    { hrefLang: "en", href: `${SITE_URL}${path}` },
    { hrefLang: "ro", href: `${SITE_URL}/ro${path}` },
    { hrefLang: "x-default", href: `${SITE_URL}${path}` },
  ];
}

/** Fires `calculator_used` once per page view, on the first edit. */
export function useCalculatorUsed(calculator: string, lang: PublicLang) {
  const trackedRef = useRef(false);
  return () => {
    if (trackedRef.current || typeof window.gtag !== "function") return;
    trackedRef.current = true;
    window.gtag("event", "calculator_used", { calculator, lang });
  };
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 leading-relaxed text-content-primary">
      <h2 className="text-xl font-semibold">{heading}</h2>
      {children}
    </section>
  );
}

/** A proportional bar with a legend, e.g. needs / wants / savings. */
export function StackedBar({
  segments,
}: {
  segments: Array<{ label: string; value: number; className: string }>;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-elevated"
        aria-hidden="true"
      >
        {total > 0 &&
          segments.map((s) => (
            <div
              key={s.label}
              className={`h-full ${s.className}`}
              style={{ width: `${(Math.max(s.value, 0) / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${s.className}`}
              aria-hidden="true"
            />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RelatedCalculators({ current }: { current: CalculatorId }) {
  const { t, to } = usePublicLocale();
  return (
    <Section heading={t("calculators.related.heading")}>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        {CALCULATORS.filter((c) => c.id !== current).map((c) => (
          <li key={c.id}>
            <Link to={to(c.path)} className={linkClass}>
              {t(`calculators.related.${c.id}.name`)}
            </Link>
            <span className="text-content-muted">
              {" "}
              — {t(`calculators.related.${c.id}.description`)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CalculatorCta({
  heading,
  body,
  button,
  appStore,
  googlePlay,
  placement,
}: {
  heading: string;
  body: string;
  button: string;
  appStore: string;
  googlePlay: string;
  /** Store-link attribution, e.g. "calculator_compound". */
  placement: string;
}) {
  const navigate = useNavigate();
  return (
    <GlassCard padding="lg">
      <div className="flex flex-col items-start gap-3">
        <h2 className="text-xl font-semibold text-content-primary">
          {heading}
        </h2>
        <p className="text-content-primary">{body}</p>
        <GlassButton variant="active" onClick={() => navigate("/register")}>
          {button}
        </GlassButton>
        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={appStoreUrl(placement)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {appStore}
          </a>
          <a
            href={playStoreUrl(placement)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {googlePlay}
          </a>
        </div>
      </div>
    </GlassCard>
  );
}
