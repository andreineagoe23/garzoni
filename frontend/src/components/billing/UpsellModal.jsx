import React from "react";
import { GlassButton, GlassCard } from "components/ui";
import { FEATURE_COPY } from "services/entitlementsService";

const UpsellModal = ({ open, onClose, feature }) => {
  if (!open) return null;

  const featureName = FEATURE_COPY[feature] || "premium feature";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <GlassCard padding="lg" className="max-w-md w-full space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Upgrade to unlock
            </p>
            <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
              {featureName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--text-color,#111827)]"
            aria-label="Close upsell dialog"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          This option is part of our Premium plan. Upgrade to remove limits,
          unlock streak repairs, richer analytics, and expanded AI tutor access.
        </p>

        <div className="flex flex-wrap gap-3">
          <GlassButton className="flex-1 justify-center" onClick={() => (window.location.href = "/payment-required")}> 
            Upgrade to Premium
          </GlassButton>
          <GlassButton variant="ghost" className="flex-1 justify-center" onClick={onClose}>
            Maybe later
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default UpsellModal;
