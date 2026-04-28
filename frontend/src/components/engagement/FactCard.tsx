import React from "react";
import { useTranslation } from "react-i18next";

type FactCardProps = {
  fact: { category?: string; text?: string } | null;
  onMarkRead: () => void;
};

function FactCard({ fact, onMarkRead }: FactCardProps) {
  const { t } = useTranslation();
  return (
    <div className="app-card p-4">
      {fact ? (
        <div className="space-y-3">
          <p className="app-eyebrow text-content-muted">{fact.category}</p>
          <p className="text-sm text-content-primary">{fact.text}</p>
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary-bright,#2a7347)] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary-bright,#2a7347)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary-bright,#2a7347)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-bright,#2a7347)]/40"
          >
            {t("missions.facts.markRead")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-content-muted">
          {t("missions.facts.empty")}
        </p>
      )}
    </div>
  );
}

export default FactCard;
