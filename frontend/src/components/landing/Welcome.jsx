import React, { useRef } from "react";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import Header from "components/layout/Header";
import "./welcome.css";
import HeroSection from "./HeroSection";
import FeatureSection from "./FeatureSection";
import ReviewsSection from "./ReviewsSection";
import CTASection from "./CTASection";

function Welcome() {
  const featureRef = useRef(null);
  const landingShellRef = useRef(null);

  const scrollToFeatures = () => {
    featureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  return (
    <div
      ref={landingShellRef}
      className="landing-shell landing-theme app-container min-h-screen flex flex-col bg-[color:var(--bg-color,#0B0F14)] text-[color:var(--text-color,#e5e7eb)]"
      style={{
        // Make the sections below the hero match the hero's neutral dark palette
        // (instead of the default slightly blue-tinted surface).
        "--card-bg": "#15191E",
        "--input-bg": "#15191E",
      }}
    >
      <div className="landing-animated-bg" aria-hidden="true" />

      <Header />

      <main className="relative z-[1] flex-1 pt-[80px] sm:pt-[96px]">
        {/* Hero (Three.js knowledge constellation) */}
        <HeroSection scrollToFeatures={scrollToFeatures} />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-12 sm:px-6 lg:px-8">
          {/* Zig-zag Features */}
          <FeatureSection featureRef={featureRef} />

          {/* Reviews */}
          <ReviewsSection />

          {/* CTA */}
          <CTASection />
        </div>
      </main>
    </div>
  );
}

export default Welcome;
