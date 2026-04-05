import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "react-bootstrap-icons";
import { ArrowRight, PlayCircle } from "lucide-react";
import { GlassButton, Modal } from "components/ui";
import ParticleStage from "./ParticleStage";
import { useTranslation } from "react-i18next";
import { getMediaBaseUrl } from "services/backendUrl";

export default function HeroSection({
  scrollToFeatures,
}: {
  scrollToFeatures: () => void;
}) {
  const demoVideoUrl = `${getMediaBaseUrl()}/media/welcome/monevo-demo.mp4`;
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      aria-label={t("landing.hero.aria")}
    >
      {/* Preload demo video as soon as the page is open so the modal opens quickly */}
      <video
        data-testid="hero-demo-preload-video"
        src={demoVideoUrl}
        preload="auto"
        muted
        autoPlay
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
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
                {t("landing.hero.badge", { count: 500 })}
              </span>
            </div>

            <h1 className="welcome-font-display mt-7 text-center sm:text-left text-3xl font-semibold tracking-tight text-white leading-[0.95] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
              {t("landing.hero.titleLine1")} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">
                {t("landing.hero.titleLine2")}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-center sm:text-left mx-auto sm:mx-0 text-sm leading-relaxed text-neutral-400 sm:text-base">
              {t("landing.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-row flex-wrap items-center justify-center sm:justify-start gap-2 pointer-events-auto sm:gap-4">
              <GlassButton
                onClick={() => navigate("/register")}
                variant="active"
                size="md"
                className="group whitespace-nowrap px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <span className="sm:hidden">
                  {t("landing.hero.ctaStartShort")}
                </span>
                <span className="hidden sm:inline">
                  {t("landing.hero.ctaStart")}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </GlassButton>

              <GlassButton
                onClick={() => setIsDemoOpen(true)}
                variant="ghost"
                size="md"
                className="whitespace-nowrap px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <PlayCircle className="h-4 w-4" />
                <span className="sm:hidden">
                  {t("landing.hero.ctaDemoShort")}
                </span>
                <span className="hidden sm:inline">
                  {t("landing.hero.ctaDemo")}
                </span>
              </GlassButton>

              <button
                type="button"
                onClick={scrollToFeatures}
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/50 sm:gap-3 sm:px-5 sm:py-3 sm:text-sm"
                aria-label={t("landing.hero.ctaExploreAria")}
              >
                <span className="sm:hidden">
                  {t("landing.hero.ctaExploreShort")}
                </span>
                <span className="hidden sm:inline">
                  {t("landing.hero.ctaExplore")}
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
                  {t("landing.hero.stats.currentStreak")}
                </span>
                <div className="flex items-end gap-1">
                  <span className="welcome-font-display text-2xl font-medium text-white">
                    12
                  </span>
                  <span className="text-xs text-neutral-500 mb-1">
                    {t("landing.hero.stats.days")}
                  </span>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="flex flex-col gap-1">
                <span className="welcome-font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {t("landing.hero.stats.totalXp")}
                </span>
                <div className="flex items-end gap-1">
                  <span className="welcome-font-display text-2xl font-medium text-white">
                    8,450
                  </span>
                  <span className="text-xs text-[#E6C87A] mb-1">
                    {t("landing.hero.stats.today")}
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
                    {t("landing.hero.topics.budgeting")}
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
                    {t("landing.hero.topics.saving")}
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
                    {t("landing.hero.topics.investing")}
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
                    {t("landing.hero.topics.credit")}
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
                    {t("landing.hero.topics.taxes")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo modal (reuses shared Modal so it appears above all sections) */}
      <Modal
        isOpen={isDemoOpen}
        title={t("landing.hero.demoModal.title")}
        onClose={() => setIsDemoOpen(false)}
      >
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <video
            src={demoVideoUrl}
            controls
            className="w-full aspect-video"
            playsInline
            preload="auto"
            aria-label={t("landing.hero.demoModal.videoAria")}
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <p className="text-sm text-white/70">
            {t("landing.hero.demoModal.subtitle")}
          </p>
          <button
            type="button"
            className="mt-5 rounded bg-[#E6C87A] px-5 py-2 text-sm font-semibold text-[#0B0F14] hover:bg-[#d4b669]"
            onClick={() => navigate("/register")}
          >
            {t("landing.hero.demoModal.startLearning")}
          </button>
        </div>
      </Modal>
    </section>
  );
}
