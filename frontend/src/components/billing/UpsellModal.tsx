import React from "react";
import { GlassButton, GlassCard } from "components/ui";
import { FEATURE_COPY } from "services/entitlementsService";
type FeatureKey = keyof typeof FEATURE_COPY;

const UpsellModal = ({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature?: FeatureKey;
}) => {
  if (!open) return null;

  const featureName = feature
    ? FEATURE_COPY[feature]
    : "Premium Feature";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <GlassCard padding="lg" className="max-w-md w-full space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Unlock Premium
            </p>
            <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
              {featureName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--text-color,#111827)]"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Upgrade to unlock this feature and more premium benefits.
        </p>

        <div className="flex flex-wrap gap-3">
          <GlassButton
            className="flex-1 justify-center"
            onClick={() => (window.location.href = "/subscriptions")}
          >
            Upgrade Now
          </GlassButton>
          <GlassButton
            variant="ghost"
            className="flex-1 justify-center"
            onClick={onClose}
          >
            Maybe Later
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default UpsellModal;
