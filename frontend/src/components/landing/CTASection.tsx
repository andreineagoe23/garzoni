import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { GlassCard, GlassButton } from "components/ui";

type CTASectionProps = {
  /** When true (welcome + light theme), copy and chrome match the pale marketing page. */
  lightMarketing?: boolean;
};

export default function CTASection({
  lightMarketing = false,
}: CTASectionProps) {
  const navigate = useNavigate();

  const cardClass = lightMarketing
    ? "relative overflow-hidden p-8 text-center sm:p-10 border border-slate-200/70 bg-white/82 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04]"
    : "relative overflow-hidden p-8 text-center sm:p-10 bg-[color:var(--card-bg,#15191E)]/70 border-white/[0.06]";

  const titleClass = lightMarketing
    ? "text-2xl font-bold text-slate-900 sm:text-3xl"
    : "text-2xl font-bold text-white sm:text-3xl";

  const leadClass = lightMarketing
    ? "mt-3 text-[15px] text-slate-600 sm:text-base"
    : "mt-3 text-[15px] text-white/60 sm:text-base";

  const disclaimerClass = lightMarketing
    ? "mt-8 text-xs text-slate-500"
    : "mt-8 text-xs text-white/40";

  const linksRowClass = lightMarketing
    ? "mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
    : "mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/70";

  const linkClass = lightMarketing
    ? "text-slate-600 underline-offset-2 hover:text-[color:var(--primary,#1d5330)] hover:underline"
    : "hover:text-white";

  return (
    <section className="relative pb-8">
      <GlassCard padding="xl" className={cardClass}>
        {/* Gold top-edge accent */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E6C87A]/40 to-transparent"
          aria-hidden="true"
        />
        <h3 className={titleClass}>
          Your path to financial mastery starts here.
        </h3>
        <p className={leadClass}>
          Free to start. No credit card. Pick up where you left off, any time.
        </p>
        <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-4">
          <GlassButton
            type="button"
            onClick={() => navigate("/register")}
            variant="active"
            size="lg"
            className="ring-1 ring-[#E6C87A]/25"
          >
            Begin your path
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => navigate("/login")}
            variant="ghost"
            className={
              lightMarketing
                ? "border border-slate-300/80 bg-white/60 text-slate-800 hover:bg-white/90"
                : undefined
            }
          >
            Log in
          </GlassButton>
        </div>
        <p className={disclaimerClass}>
          Garzoni is a financial education platform, not a financial adviser.
        </p>
        {/* Welcome-page nav links */}
        <div className={linksRowClass}>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            <Link to="/marketing" className={linkClass}>
              Features
            </Link>
            <Link to="/subscriptions" className={linkClass}>
              Pricing
            </Link>
            <Link to="/support" className={linkClass}>
              Support
            </Link>
            <span
              className={lightMarketing ? "text-slate-300" : "text-white/20"}
            >
              ·
            </span>
            <Link to="/privacy-policy" className={linkClass}>
              Privacy
            </Link>
            <Link to="/terms-of-service" className={linkClass}>
              Terms
            </Link>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
