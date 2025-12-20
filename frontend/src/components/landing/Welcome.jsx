import React, { useEffect, useRef } from "react";
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

  // Make the landing background parallax match the hero particles (subtle + smoothed).
  useEffect(() => {
    const shell = landingShellRef.current;
    if (!shell) return undefined;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    if (prefersReducedMotion) return undefined;

    let rafId = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      // Smooth follow (similar vibe to the particle group's mouse easing)
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      shell.style.setProperty(
        "--landing-parallax-x",
        `${current.x.toFixed(2)}px`
      );
      shell.style.setProperty(
        "--landing-parallax-y",
        `${current.y.toFixed(2)}px`
      );
    };

    const onPointerMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w) * 2 - 1; // -1..1
      const ny = (e.clientY / h) * 2 - 1; // -1..1

      // Invert slightly so it feels like depth (background lags behind pointer).
      const maxX = 10;
      const maxY = 7;
      target.x = -nx * maxX;
      target.y = -ny * maxY;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      shell.style.removeProperty("--landing-parallax-x");
      shell.style.removeProperty("--landing-parallax-y");
    };
  }, []);

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
