import React from "react";
import { Link, useNavigate } from "react-router-dom";
import MascotMedia from "components/common/MascotMedia";
import { GlassCard, GlassButton } from "components/ui";

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="relative pb-8">
      <GlassCard
        padding="xl"
        className="relative p-8 text-center sm:p-10 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
      >
        <MascotMedia
          mascot="owl"
          className="absolute right-4 top-1/2 h-14 w-14 -translate-y-1/2 object-contain opacity-70 sm:right-6 sm:h-16 sm:w-16"
        />
        <h3 className="text-2xl font-bold text-white sm:text-3xl">
          Ready to start your money journey?
        </h3>
        <p className="mt-3 text-sm text-white/70 sm:text-base">
          Create an account in seconds, or log in to continue where you left
          off.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <GlassButton
            type="button"
            onClick={() => navigate("/register")}
            variant="active"
          >
            Create account
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => navigate("/login")}
            variant="ghost"
          >
            Log in
          </GlassButton>
        </div>
        <p className="mt-6 text-xs text-white/60">
          Monevo is a financial education platform, not a financial adviser.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          <Link to="/financial-disclaimer" className="hover:text-white">
            Financial Disclaimer
          </Link>
          <Link to="/privacy-policy" className="hover:text-white">
            Privacy
          </Link>
          <Link to="/terms-of-service" className="hover:text-white">
            Terms
          </Link>
        </div>
      </GlassCard>
    </section>
  );
}
