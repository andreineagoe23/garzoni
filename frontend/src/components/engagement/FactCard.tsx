import React from "react";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

type FactCardProps = {
  fact: { category?: string; text?: string } | null;
  onMarkRead: () => void;
};

function FactCard({ fact, onMarkRead }: FactCardProps) {
  const { t } = useTranslation();
  return (
    <GlassCard padding="md" className="bg-[color:var(--card-bg,#ffffff)]/60">
      {fact ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#ffd700)]">
            {fact.category}
          </p>
          <p className="text-sm text-content-primary">{fact.text}</p>
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {t("missions.facts.markRead")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-content-muted">
          {t("missions.facts.empty")}
        </p>
      )}
    </GlassCard>
  );
}

export default FactCard;
