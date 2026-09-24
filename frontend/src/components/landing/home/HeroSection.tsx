import React from "react";
import { Trans, useTranslation } from "react-i18next";
import HeroGlobe from "./HeroGlobe";
import HeroStats from "./HeroStats";
import StoreBadges from "./StoreBadges";

export default function HeroSection() {
  const { t } = useTranslation();

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
          <StoreBadges />
          <HeroStats />
        </div>
      </div>
    </section>
  );
}
