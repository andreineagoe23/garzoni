import React from "react";
import SavingsGoalCalculator from "components/tools/SavingsGoalCalculator";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

const BasicFinanceTools = () => {
  const { t } = useTranslation("tools");
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("basicTools.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("basicTools.subtitle", {
            defaultValue:
              "Start with simple calculators to keep your savings goals on track.",
          })}
        </p>
      </header>

      <GlassCard padding="lg">
        <SavingsGoalCalculator />
      </GlassCard>
    </section>
  );
};

export default BasicFinanceTools;
