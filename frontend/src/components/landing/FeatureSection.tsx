import React, { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import { useLandingData } from "./landingData";
import { useTranslation } from "react-i18next";
import { getMediaBaseUrl } from "services/backendUrl";

type FeatureSectionProps = {
  featureRef?: React.RefObject<HTMLElement>;
};

export default function FeatureSection({ featureRef }: FeatureSectionProps) {
  const demoVideoUrl = `${getMediaBaseUrl()}/media/welcome/garzoni-demo.mp4`;
  const { features } = useLandingData();
  const { t } = useTranslation();
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    if (prefersReducedMotion) {
      setVisibleItems(features.map((_, index) => index));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const entryIndex = Number(target.dataset.index);
            setVisibleItems((prev) =>
              prev.includes(entryIndex) ? prev : [...prev, entryIndex]
            );
            observer.unobserve(target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -5% 0px",
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [features]);

  return (
    <section ref={featureRef} className="relative scroll-mt-[110px]">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-4 h-px w-12 bg-gradient-to-r from-transparent via-[#E6C87A]/50 to-transparent" />
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.features.title")}
        </h2>
        <p className="mt-4 text-[15px] text-[color:var(--muted-text,rgba(229,231,235,0.72))] sm:text-base">
          {t("landing.features.subtitle")}
        </p>
      </div>

      <div className="relative mt-12">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-white/10 lg:block" />

        <div className="space-y-8 lg:space-y-10">
          {features.slice(0, 2).map((feature, i) => {
            const index = i;
            const isLeft = index % 2 === 0;
            const isVisible = visibleItems.includes(index);

            return (
              <div
                key={`feature-${index}-${feature.title}`}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                data-index={index}
                className={[
                  "relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[1fr_48px_1fr] lg:gap-8",
                  "transition-all duration-700 ease-out",
                  "motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100",
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8 lg:translate-y-10",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={`lg:col-start-1 ${
                    isLeft
                      ? "lg:order-1 lg:justify-self-end"
                      : "lg:order-3 lg:col-start-3 lg:justify-self-start"
                  }`}
                >
                  <GlassCard
                    padding="lg"
                    className="p-6 lg:p-8 bg-[#0B0F14] border-white/10 landing-feature-card"
                  >
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E6C87A]/15 bg-[#E6C87A]/[0.06] text-[#E6C87A]/90">
                        {feature.icon}
                      </span>
                      <div className="min-w-0 text-left">
                        <h3 className="text-xl font-bold text-white">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-sm text-white/70">
                          {feature.text}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-white/75">
                          {feature.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2">
                              <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/20 text-[color:var(--primary,#1d5330)]">
                                <GarzoniIcon name="check" size={14} />
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Middle node - always centered on the vertical line */}
                <div className="relative hidden lg:order-2 lg:col-start-2 lg:flex lg:items-center lg:justify-center">
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6C87A]/40 blur-[1px]" />
                  <div
                    key={`feature-number-${index}`}
                    className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0B0F14] text-sm font-bold text-white/85 shadow-lg shadow-black/40 backdrop-blur"
                  >
                    {index + 1}
                  </div>
                  <div
                    className={`pointer-events-none absolute top-1/2 h-px w-10 -translate-y-1/2 bg-white/10 ${
                      isLeft
                        ? "right-[calc(50%+24px)]"
                        : "left-[calc(50%+24px)]"
                    }`}
                  />
                </div>
              </div>
            );
          })}

          {/* Demo video row - same grid so the vertical line continues */}
          <div className="relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[1fr_minmax(280px,420px)_1fr] lg:gap-8">
            <div className="hidden lg:block" aria-hidden />
            <div className="relative flex flex-col items-center justify-center lg:col-start-2">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0B0F14] text-white/85 shadow-lg shadow-black/40 backdrop-blur lg:mb-4">
                <Play
                  className="h-5 w-5 text-[color:var(--primary,#1d5330)]"
                  aria-hidden
                />
              </div>
              <GlassCard
                padding="lg"
                className="w-full overflow-hidden rounded-xl border-white/10 bg-[#0B0F14] p-0"
              >
                <video
                  src={demoVideoUrl}
                  controls
                  className="aspect-video w-full"
                  playsInline
                  preload="metadata"
                  aria-label={t("landing.hero.demoModal.videoAria")}
                >
                  <track
                    kind="captions"
                    src=""
                    label="No captions available"
                    default
                  />
                  Your browser does not support the video tag.
                </video>
              </GlassCard>
            </div>
            <div className="hidden lg:block" aria-hidden />
          </div>

          {features.slice(2).map((feature, i) => {
            const index = i + 2;
            const isLeft = index % 2 === 0;
            const isVisible = visibleItems.includes(index);

            return (
              <div
                key={`feature-${index}-${feature.title}`}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                data-index={index}
                className={[
                  "relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[1fr_48px_1fr] lg:gap-8",
                  "transition-all duration-700 ease-out",
                  "motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100",
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8 lg:translate-y-10",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={`lg:col-start-1 ${
                    isLeft
                      ? "lg:order-1 lg:justify-self-end"
                      : "lg:order-3 lg:col-start-3 lg:justify-self-start"
                  }`}
                >
                  <GlassCard
                    padding="lg"
                    className="p-6 lg:p-8 bg-[#0B0F14] border-white/10 landing-feature-card"
                  >
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E6C87A]/15 bg-[#E6C87A]/[0.06] text-[#E6C87A]/90">
                        {feature.icon}
                      </span>
                      <div className="min-w-0 text-left">
                        <h3 className="text-xl font-bold text-white">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-sm text-white/70">
                          {feature.text}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-white/75">
                          {feature.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2">
                              <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/20 text-[color:var(--primary,#1d5330)]">
                                <GarzoniIcon name="check" size={14} />
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Middle node - always centered on the vertical line */}
                <div className="relative hidden lg:order-2 lg:col-start-2 lg:flex lg:items-center lg:justify-center">
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6C87A]/40 blur-[1px]" />
                  <div
                    key={`feature-number-${index}`}
                    className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0B0F14] text-sm font-bold text-white/85 shadow-lg shadow-black/40 backdrop-blur"
                  >
                    {index + 1}
                  </div>
                  <div
                    className={`pointer-events-none absolute top-1/2 h-px w-10 -translate-y-1/2 bg-white/10 ${
                      isLeft
                        ? "right-[calc(50%+24px)]"
                        : "left-[calc(50%+24px)]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
