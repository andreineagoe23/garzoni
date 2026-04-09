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
        <div className="mx-auto mb-4 h-px w-12 bg-gradient-to-r from-transparent via-[#E6C87A]/50 to-transparent" />
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.reviews.title")}
        </h2>
        <p className="mt-4 text-[15px] text-content-muted sm:text-base">
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
              className="landing-review-card h-full p-6 bg-[color:var(--card-bg,#15191E)]/65 border-white/[0.06] hover:border-[#E6C87A]/15 transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[color:var(--gold,#E6C87A)]">
                  {Array.from({ length: 5 }).map((_, starIdx) => (
                    <StarFill key={starIdx} size={14} />
                  ))}
                </div>
                <span
                  className="welcome-font-display text-2xl leading-none text-[#E6C87A]/20 select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                &ldquo;{review.quote}&rdquo;
              </p>
              <div className="mt-6 border-t border-white/[0.06] pt-4">
                <p className="text-sm font-semibold text-white">
                  {review.name}
                </p>
                <p className="text-xs text-white/50">{review.title}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
