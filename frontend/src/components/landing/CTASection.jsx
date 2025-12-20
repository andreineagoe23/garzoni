import React from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard, GlassButton } from "components/ui";

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="relative pb-8">
      <GlassCard
        padding="xl"
        className="p-8 text-center sm:p-10 bg-[color:var(--card-bg,#15191E)]/70 border-white/10"
      >
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
      </GlassCard>
    </section>
  );
}
