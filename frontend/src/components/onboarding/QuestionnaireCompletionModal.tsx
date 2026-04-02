import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { GlassButton } from "components/ui";
import MascotMedia from "components/common/MascotMedia";

interface QuestionnaireCompletionModalProps {
  isOpen: boolean;
  rewards: {
    xp: number;
    coins: number;
  };
  onClose: () => void;
  onStartLearning: () => void;
}

const QuestionnaireCompletionModal: React.FC<
  QuestionnaireCompletionModalProps
> = ({ isOpen, rewards, onClose, onStartLearning }) => {
  const { t } = useTranslation();
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (isOpen && !confettiFiredRef.current) {
      confettiFiredRef.current = true;

      // Fire confetti from multiple angles
      const duration = 3000;
      const end = Date.now() + duration;

      const interval = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }

        // Left side
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#1d5330", "#2e7d32", "#ffd700", "#f59e0b", "#dc2626"],
        });

        // Right side
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#1d5330", "#2e7d32", "#ffd700", "#f59e0b", "#dc2626"],
        });

        // Center burst
        if (Math.random() > 0.7) {
          confetti({
            particleCount: 5,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#1d5330", "#2e7d32", "#ffd700", "#f59e0b", "#dc2626"],
          });
        }
      }, 100);
    }

    return () => {
      if (!isOpen) {
        confettiFiredRef.current = false;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-br from-[color:var(--card-bg,#ffffff)] via-[color:var(--card-bg,#ffffff)] to-[color:var(--primary,#1d5330)]/10 p-8 text-center shadow-2xl">
        {/* Mascot */}
        <div className="mx-auto mb-4 flex flex-col items-center gap-2">
          <MascotMedia mascot="owl" className="h-20 w-20 object-contain" />
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("onboarding.completionModal.mascotMessage")}
          </p>
        </div>

        {/* Title */}
        <h2
          id="completion-modal-title"
          className="mb-3 text-3xl font-bold text-[color:var(--accent,#111827)]"
        >
          {t("onboarding.completionModal.title")}
        </h2>

        <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("onboarding.completionModal.subtitle")}
        </p>

        {/* Rewards */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[color:var(--primary,#1d5330)]/20 bg-[color:var(--primary,#1d5330)]/5 p-4">
            <div className="mb-2 text-2xl font-bold text-[color:var(--primary,#1d5330)]">
              +{rewards.xp}
            </div>
            <div className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("onboarding.completionModal.xpPoints")}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--primary,#1d5330)]/20 bg-[color:var(--primary,#1d5330)]/5 p-4">
            <div className="mb-2 text-2xl font-bold text-[color:var(--primary,#1d5330)]">
              +{rewards.coins}
            </div>
            <div className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("onboarding.completionModal.coins")}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <GlassButton variant="primary" size="lg" onClick={onStartLearning}>
            {t("onboarding.completionModal.choosePlan")}
          </GlassButton>
          <GlassButton variant="ghost" size="lg" onClick={onClose}>
            {t("onboarding.completionModal.close")}
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireCompletionModal;
