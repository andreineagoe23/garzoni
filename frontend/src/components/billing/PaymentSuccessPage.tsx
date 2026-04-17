/**
 * Shown after Stripe checkout success. Displays a pre-generated progress bar
 * (25 → 50 → 70 → 100%) with step messages, then redirects to personalized path.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import apiClient from "services/httpClient";
import { useAuth } from "contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "lib/reactQuery";

const STEPS: { percent: number; messageKey: string }[] = [
  { percent: 25, messageKey: "subscriptions.paymentSuccess.fetchingAnswers" },
  {
    percent: 50,
    messageKey: "subscriptions.paymentSuccess.syncingSubscription",
  },
  { percent: 70, messageKey: "subscriptions.paymentSuccess.buildingPaths" },
  { percent: 100, messageKey: "subscriptions.paymentSuccess.ready" },
];

const STEP_DURATION_MS = 1200;

const PaymentSuccessPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const { reloadEntitlements, loadProfile } = useAuth();
  const queryClient = useQueryClient();
  const verifiedRef = useRef(false);

  // Belt-and-braces: call /api/verify-session/ on mount so the profile is flipped
  // to paid/plus/pro even if the Stripe webhook is misrouted, delayed, or failing.
  // Then invalidate cached profile + entitlements so downstream pages read the new plan.
  useEffect(() => {
    if (!sessionId || verifiedRef.current) return;
    verifiedRef.current = true;
    const run = async () => {
      try {
        await apiClient.post("/verify-session/", { session_id: sessionId });
      } catch {
        // VerifySessionView returns 202 "pending" while Stripe finalizes the
        // subscription; it's safe to ignore and rely on the later refetch.
      }
      try {
        await Promise.all([
          loadProfile?.({ force: true }),
          reloadEntitlements?.(),
        ]);
      } catch {
        // Downstream page will retry on mount.
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
    };
    void run();
  }, [sessionId, loadProfile, reloadEntitlements, queryClient]);

  useEffect(() => {
    if (!sessionId) {
      navigate("/personalized-path", { replace: true });
      return;
    }

    const step = STEPS[stepIndex];
    if (!step) {
      navigate(
        `/personalized-path?session_id=${encodeURIComponent(sessionId)}&redirect=upgradeComplete`,
        { replace: true }
      );
      return;
    }

    setProgress(step.percent);

    if (stepIndex === STEPS.length - 1) {
      const timeout = setTimeout(() => {
        navigate(
          `/personalized-path?session_id=${encodeURIComponent(sessionId)}&redirect=upgradeComplete`,
          { replace: true }
        );
      }, 800);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => setStepIndex((i) => i + 1),
      STEP_DURATION_MS
    );
    return () => clearTimeout(timeout);
  }, [sessionId, stepIndex, navigate]);

  if (!sessionId) {
    return null;
  }

  const step = STEPS[stepIndex];
  const message = step ? t(step.messageKey) : "";

  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-8 bg-surface-page px-4"
      aria-live="polite"
      aria-label={t("subscriptions.paymentSuccess.ariaLabel")}
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/10 text-4xl">
          <GarzoniIcon name="check" size={28} />
        </div>
        <h1 className="text-xl font-bold text-content-primary sm:text-2xl">
          {t("subscriptions.paymentSuccess.title")}
        </h1>
        <p className="text-sm text-content-muted">{message}</p>
        <div className="space-y-2">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={message}
          >
            <div
              className="h-full rounded-full bg-[color:var(--primary,#1d5330)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-medium text-content-muted">{progress}%</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
