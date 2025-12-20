import React from "react";
import { GlassCard } from "components/ui";
import { features } from "./landingData";

export default function FeatureSection({ featureRef }) {
  return (
    <section ref={featureRef} className="relative scroll-mt-[110px]">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to learn, practice, and win.
        </h2>
        <p className="mt-4 text-sm text-[color:var(--muted-text,rgba(229,231,235,0.72))] sm:text-base">
          Built for consistency: small lessons, real practice, and a system that
          keeps you coming back.
        </p>
      </div>

      <div className="relative mt-12">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-white/10 lg:block" />

        <div className="space-y-8 lg:space-y-10">
          {features.map((feature, index) => {
            const isLeft = index % 2 === 0;
            const sideColStart = isLeft ? "lg:col-start-1" : "lg:col-start-8";

            return (
              <div
                key={feature.title}
                className="relative grid grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-6"
              >
                <div className={`lg:col-span-5 ${sideColStart}`}>
                  <GlassCard
                    padding="lg"
                    className="p-6 lg:p-8 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
                  >
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/90">
                        {feature.icon}
                      </span>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                          Feature {index + 1}
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-white">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-sm text-white/70">
                          {feature.text}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-white/75">
                          {feature.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2">
                              <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/20 text-[color:var(--primary,#1d5330)]">
                                ✓
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </GlassCard>
                </div>

                {/* Middle node */}
                <div className="relative hidden lg:col-span-2 lg:flex lg:items-center lg:justify-center">
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--primary,#1d5330)]/70 blur-[0.5px]" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[color:var(--card-bg,#15191E)]/70 text-sm font-bold text-white/85 shadow-lg shadow-black/40 backdrop-blur">
                    {index + 1}
                  </div>
                  <div
                    className={`pointer-events-none absolute top-1/2 h-px w-10 -translate-y-1/2 bg-white/10 ${
                      isLeft
                        ? "left-[calc(50%+24px)]"
                        : "right-[calc(50%+24px)]"
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
