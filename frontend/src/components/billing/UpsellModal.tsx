import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  if (!open) return null;

  const featureName = feature
    ? t(`billing.features.${feature}`)
    : t("billing.premiumFeature");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <GlassCard padding="lg" className="max-w-md w-full space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-content-muted">
              {t("billing.unlockPremium")}
            </p>
            <h3 className="text-xl font-bold text-content-primary">
              {featureName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-content-muted transition hover:text-content-primary"
            aria-label={t("billing.closeModal")}
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-content-muted">
          {t("billing.upgradeDescription")}
        </p>

        <div className="flex flex-wrap gap-3">
          <GlassButton
            className="flex-1 justify-center"
            onClick={() => (window.location.href = "/subscriptions")}
          >
            {t("billing.upgradeNow")}
          </GlassButton>
          <GlassButton
            variant="ghost"
            className="flex-1 justify-center"
            onClick={onClose}
          >
            {t("billing.maybeLater")}
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default UpsellModal;
