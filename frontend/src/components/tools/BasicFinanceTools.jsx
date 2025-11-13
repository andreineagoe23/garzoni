import React from "react";
import SavingsGoalCalculator from "components/tools/SavingsGoalCalculator";
import { GlassCard } from "components/ui";

const BasicFinanceTools = () => {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Basic Finance Tools
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Start with simple calculators to keep your savings goals on track.
        </p>
      </header>

      <GlassCard padding="lg">
        <SavingsGoalCalculator />
      </GlassCard>
    </section>
  );
};

export default BasicFinanceTools;
