import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { GlassButton } from "components/ui";

interface QuestionnaireCompletionModalProps {
  isOpen: boolean;
  rewards: {
    xp: number;
    coins: number;
  };
  onClose: () => void;
  onStartLearning: () => void;
}

const QuestionnaireCompletionModal: React.FC<QuestionnaireCompletionModalProps> = ({
  isOpen,
  rewards,
  onClose,
  onStartLearning,
}) => {
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
          colors: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
        });

        // Right side
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
        });

        // Center burst
        if (Math.random() > 0.7) {
          confetti({
            particleCount: 5,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
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
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-br from-[color:var(--card-bg,#ffffff)] via-[color:var(--card-bg,#ffffff)] to-[color:var(--primary,#2563eb)]/10 p-8 text-center shadow-2xl">
        {/* Success Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/80 shadow-lg">
          <svg
            className="h-12 w-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="completion-modal-title"
          className="mb-3 text-3xl font-bold text-[color:var(--accent,#111827)]"
        >
          🎉 Congratulations!
        </h2>

        <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">
          You've completed onboarding. Here are your rewards:
        </p>

        {/* Rewards */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[color:var(--primary,#2563eb)]/20 bg-[color:var(--primary,#2563eb)]/5 p-4">
            <div className="mb-2 text-2xl font-bold text-[color:var(--primary,#2563eb)]">
              +{rewards.xp}
            </div>
            <div className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">XP Points</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--primary,#2563eb)]/20 bg-[color:var(--primary,#2563eb)]/5 p-4">
            <div className="mb-2 text-2xl font-bold text-[color:var(--primary,#2563eb)]">
              +{rewards.coins}
            </div>
            <div className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">Coins</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <GlassButton variant="primary" size="lg" onClick={onStartLearning}>
            Choose a Plan →
          </GlassButton>
          <GlassButton variant="ghost" size="lg" onClick={onClose}>
            Close
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireCompletionModal;
