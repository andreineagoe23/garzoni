import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "react-bootstrap-icons";
import { ArrowRight, PlayCircle } from "lucide-react";
import { GlassButton } from "components/ui";
import ParticleStage from "./ParticleStage";
import { useTranslation } from "react-i18next";

export default function HeroSection({
  scrollToFeatures,
}: {
  scrollToFeatures: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("landing");

  const heroRef = useRef<HTMLElement | null>(null);
  const brainStageRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const trackersRef = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);

  const flowRef = useRef(0.15);

  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <section
      ref={heroRef}
      className="welcome-hero relative isolate bg-[#0B0F14] min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-96px)]"
      aria-label={t("hero.ariaLabel")}
    >
      <div className="w-full px-4 sm:pl-10 sm:pr-5 lg:pl-14 lg:pr-8 min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-96px)]">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12 min-h-[calc(100vh-80px)] sm:min-h-[calc(100vh-96px)] items-stretch">
          {/* Left: copy + CTAs */}
          <div className="relative z-10 flex flex-col items-center sm:items-start justify-center py-6 sm:py-8 lg:py-0 sm:pl-6">
            <div className="inline-flex w-fit self-center sm:self-start items-center gap-1.5 whitespace-nowrap rounded-full border border-[#1D5330]/25 bg-[#1D5330]/10 px-2.5 py-0.5 backdrop-blur-sm">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6C87A] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E6C87A]" />
              </span>
              <span className="welcome-font-mono text-[11px] uppercase tracking-wide text-[#E6C87A]">
                {t("hero.newTag")}
              </span>
            </div>

            <h1 className="welcome-font-display mt-7 text-center sm:text-left text-5xl font-semibold tracking-tight text-white leading-[0.95] sm:text-6xl md:text-7xl lg:text-7xl xl:text-8xl">
              {t("hero.titleLead")} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">
                {t("hero.titleAccent")}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-center sm:text-left mx-auto sm:mx-0 text-sm leading-relaxed text-neutral-400 sm:text-base">
              {t("hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-row flex-wrap items-center justify-center sm:justify-start gap-2 pointer-events-auto sm:gap-4">
              <GlassButton
                onClick={() => navigate("/register")}
                variant="active"
                size="md"
                className="group whitespace-nowrap px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <span className="sm:hidden">{t("hero.startShort")}</span>
                <span className="hidden sm:inline">{t("hero.startLong")}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </GlassButton>

              <GlassButton
                onClick={() => setIsDemoOpen(true)}
                variant="ghost"
                size="md"
                className="whitespace-nowrap px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <PlayCircle className="h-4 w-4" />
                <span className="sm:hidden">{t("hero.demoShort")}</span>
                <span className="hidden sm:inline">{t("hero.demoLong")}</span>
              </GlassButton>

              <button
                type="button"
                onClick={scrollToFeatures}
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/50 sm:gap-3 sm:px-5 sm:py-3 sm:text-sm"
                aria-label={t("hero.scrollAria")}
              >
                <span className="sm:hidden">{t("hero.exploreShort")}</span>
                <span className="hidden sm:inline">
                  {t("hero.exploreLong")}
                </span>
                <ChevronDown
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-y-0.5 sm:hidden"
                />
                <ChevronDown
                  size={18}
                  className="hidden transition-transform duration-200 group-hover:translate-y-0.5 sm:inline-block"
                />
              </button>
            </div>

            {/* Stats */}
            <div className="mt-10 hidden md:flex gap-8 pointer-events-auto">
              <div className="flex flex-col gap-1">
                <span className="welcome-font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {t("hero.currentStreak")}
                </span>
                <div className="flex items-end gap-1">
                  <span className="welcome-font-display text-2xl font-medium text-white">
                    12
                  </span>
                  <span className="text-xs text-neutral-500 mb-1">
                    {t("hero.days")}
                  </span>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="flex flex-col gap-1">
                <span className="welcome-font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {t("hero.totalXp")}
                </span>
                <div className="flex items-end gap-1">
                  <span className="welcome-font-display text-2xl font-medium text-white">
                    8,450
                  </span>
                  <span className="text-xs text-[#E6C87A] mb-1">
                    {t("hero.todayGain")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: particle brain stage */}
          <div className="relative z-0 flex items-stretch py-2 sm:py-4 lg:py-0">
            <div
              ref={brainStageRef}
              className="relative w-full overflow-hidden bg-[#0B0F14] h-[420px] sm:h-[520px] lg:h-full"
            >
              <div
                ref={canvasContainerRef}
                className="absolute inset-0 z-0"
                aria-hidden="true"
              >
                <ParticleStage
                  canvasContainerRef={canvasContainerRef}
                  brainStageRef={brainStageRef}
                  topicRefs={topicRefs}
                  lineRefs={lineRefs}
                  flowRef={flowRef}
                />
              </div>

              <svg
                ref={svgRef}
                id="tracker-lines"
                aria-hidden="true"
                className="transition-opacity duration-300"
                style={{ opacity: 1 }}
              >
                {Array.from({ length: 4 }).map((_, idx) => (
                  <line
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    ref={(el) => {
                      lineRefs.current[idx] = el;
                    }}
                    className={[
                      "welcome-svg-line",
                      idx === 2 ? "active" : "",
                    ].join(" ")}
                  />
                ))}
              </svg>

              {/* Node labels (HUD) */}
              <div
                ref={trackersRef}
                className="welcome-trackers transition-opacity duration-300"
                aria-hidden="true"
                style={{ opacity: 1 }}
              >
                <div
                  className="welcome-point-marker"
                  ref={(el) => {
                    topicRefs.current.budgeting = el;
                  }}
                >
                  <div className="welcome-point-dot" />
                  <div className="welcome-point-corner welcome-pc-tl" />
                  <div className="welcome-point-corner welcome-pc-br" />
                  <div className="welcome-point-label">
                    {t("hero.topicBudgeting")}
                  </div>
                </div>

                <div
                  className="welcome-point-marker"
                  ref={(el) => {
                    topicRefs.current.saving = el;
                  }}
                >
                  <div className="welcome-point-dot" />
                  <div className="welcome-point-corner welcome-pc-tl" />
                  <div className="welcome-point-corner welcome-pc-br" />
                  <div className="welcome-point-label">
                    {t("hero.topicSaving")}
                  </div>
                </div>

                <div
                  className="welcome-point-marker"
                  ref={(el) => {
                    topicRefs.current.investing = el;
                  }}
                >
                  <div className="welcome-point-dot" />
                  <div className="welcome-point-corner welcome-pc-tl" />
                  <div className="welcome-point-corner welcome-pc-br" />
                  <div className="welcome-point-label">
                    {t("hero.topicInvesting")}
                  </div>
                </div>

                <div
                  className="welcome-point-marker"
                  ref={(el) => {
                    topicRefs.current.credit = el;
                  }}
                >
                  <div className="welcome-point-dot" />
                  <div className="welcome-point-corner welcome-pc-tl" />
                  <div className="welcome-point-corner welcome-pc-br" />
                  <div className="welcome-point-label">
                    {t("hero.topicCredit")}
                  </div>
                </div>

                <div
                  className="welcome-point-marker"
                  ref={(el) => {
                    topicRefs.current.taxes = el;
                  }}
                >
                  <div className="welcome-point-dot" />
                  <div className="welcome-point-corner welcome-pc-tl" />
                  <div className="welcome-point-corner welcome-pc-br" />
                  <div className="welcome-point-label">
                    {t("hero.topicTaxes")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo modal (lightweight, self-contained) */}
      {isDemoOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("demo.dialogLabel")}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsDemoOpen(false)}
            aria-label={t("demo.closeAria")}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B0F14]/85 p-6 backdrop-blur-xl shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-[#E6C87A]" />
                <span className="welcome-font-display text-base font-semibold text-white">
                  {t("demo.title")}
                </span>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                onClick={() => setIsDemoOpen(false)}
              >
                {t("demo.close")}
              </button>
            </div>
            <p className="mt-3 text-sm text-white/70">{t("demo.body")}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="rounded border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                onClick={() => setIsDemoOpen(false)}
              >
                {t("demo.notNow")}
              </button>
              <button
                type="button"
                className="rounded bg-[#E6C87A] px-5 py-2 text-sm font-semibold text-[#0B0F14] hover:bg-[#d4b669]"
                onClick={() => navigate("/register")}
              >
                {t("demo.startPath")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
