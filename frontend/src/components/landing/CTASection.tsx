import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { GlassCard, GlassButton } from "components/ui";

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="relative pb-8">
      <GlassCard
        padding="xl"
        className="relative p-8 text-center sm:p-10 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
      >
        <h3 className="text-2xl font-bold text-white sm:text-3xl">
          Ready to start your money journey?
        </h3>
        <p className="mt-3 text-sm text-white/70 sm:text-base">
          Create an account in seconds, or log in to continue where you left
          off.
        </p>
        <div className="mt-7 flex flex-row flex-wrap items-center justify-center gap-4 sm:gap-4">
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
          Garzoni is a financial education platform, not a financial adviser.
        </p>
        {/* Welcome-page "footer" links: grid on mobile for better scanning */}
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          <div className="grid grid-cols-2 items-center justify-center gap-x-3 gap-y-1 sm:hidden">
            <Link to="/privacy-policy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms-of-service" className="hover:text-white">
              Terms
            </Link>
          </div>
          <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/privacy-policy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms-of-service" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
