import React from "react";
import { StarFill } from "react-bootstrap-icons";
import { GlassCard } from "components/ui";
import { useLandingData } from "./landingData";
import { useTranslation } from "react-i18next";

export default function ReviewsSection() {
  const { reviews } = useLandingData();
  const { t } = useTranslation();
  const marqueeReviews = [...reviews, ...reviews];
  const marqueeDuration = `${Math.max(36, reviews.length * 7)}s`;

  return (
    <section className="relative">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.reviews.title")}
        </h2>
        <p className="mt-4 text-sm text-[color:var(--muted-text,rgba(229,231,235,0.72))] sm:text-base">
          {t("landing.reviews.subtitle")}
        </p>
      </div>

      <div
        className="landing-review-marquee mt-10"
        style={
          {
            "--landing-review-duration": marqueeDuration,
          } as React.CSSProperties
        }
        aria-label={t("landing.reviews.aria")}
      >
        <div className="landing-review-track" aria-hidden="true">
          {marqueeReviews.map((review, idx) => (
            <GlassCard
              key={`${review.id}-${idx}`}
              padding="lg"
              tabIndex={0}
              role="article"
              aria-label={t("landing.reviews.cardAria", { name: review.name })}
              className="landing-review-card h-full p-6 bg-[color:var(--card-bg,#15191E)]/65 border-white/10"
            >
              <div className="flex items-center gap-1 text-[color:var(--gold,#E6C87A)]">
                {Array.from({ length: 5 }).map((_, starIdx) => (
                  <StarFill key={starIdx} size={16} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                "{review.quote}"
              </p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-sm font-semibold text-white">
                  {review.name}
                </p>
                <p className="text-xs text-white/60">{review.title}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
