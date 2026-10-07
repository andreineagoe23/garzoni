import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "components/ui";
import { detectMobileOs } from "utils/storeLinks";
import HeroGlobe from "./HeroGlobe";
import HeroStats from "./HeroStats";
import StoreBadges from "./StoreBadges";

export default function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onPhone = detectMobileOs() !== null;

  return (
    <section className="gzh-hero" aria-labelledby="gzh-hero-title">
      <div className="gzh-hero__grid">
        <HeroGlobe />
        <div className="gzh-hero__copy">
          <h1 id="gzh-hero-title" className="gzh-h1">
            <Trans
              i18nKey="welcome.hero.title"
              components={{
                accent: <span key="accent" className="gzh-accent" />,
              }}
            />
          </h1>
          <p className="gzh-lede">{t("welcome.hero.body")}</p>
          {onPhone ? (
            <StoreBadges placement="hero" />
          ) : (
            <div className="flex flex-col items-start gap-3">
              <GlassButton
                variant="active"
                size="lg"
                onClick={() => navigate("/register")}
              >
                {t("welcome.hero.startWeb")}
              </GlassButton>
              <span className="text-sm text-content-muted">
                {t("welcome.hero.orGetApp")}
              </span>
              <div className="flex items-center gap-4">
                <StoreBadges placement="hero" />
                {/* White square baked into the SVG keeps it scannable in dark mode. */}
                <img
                  src="/qr-get-app.svg"
                  alt={t("welcome.hero.qrAlt")}
                  width={88}
                  height={88}
                  className="rounded-card"
                  loading="lazy"
                />
              </div>
            </div>
          )}
          <HeroStats />
        </div>
      </div>
    </section>
  );
}
