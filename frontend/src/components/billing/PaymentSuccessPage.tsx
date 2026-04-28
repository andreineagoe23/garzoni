import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const STEPS = [
  "Confirming your plan",
  "Unlocking premium content",
  "Setting up your experience",
] as const;

// ms at which each step becomes visible / gets its checkmark
const TIMING = {
  step0Show: 350,
  step0Done: 1100,
  step1Show: 1250,
  step1Done: 2000,
  step2Show: 2150,
  step2Done: 2900,
  reveal: 3200,
  redirect: 4600,
};

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [stepVisible, setStepVisible] = useState([false, false, false]);
  const [stepDone, setStepDone] = useState([false, false, false]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const show = (i: number) =>
      setStepVisible((p) => {
        const n = [...p];
        n[i] = true;
        return n;
      });
    const done = (i: number) =>
      setStepDone((p) => {
        const n = [...p];
        n[i] = true;
        return n;
      });

    const ids = [
      setTimeout(() => show(0), TIMING.step0Show),
      setTimeout(() => done(0), TIMING.step0Done),
      setTimeout(() => show(1), TIMING.step1Show),
      setTimeout(() => done(1), TIMING.step1Done),
      setTimeout(() => show(2), TIMING.step2Show),
      setTimeout(() => done(2), TIMING.step2Done),
      setTimeout(() => setRevealed(true), TIMING.reveal),
      setTimeout(() => {
        const target = sessionId
          ? `/personalized-path?session_id=${encodeURIComponent(sessionId)}`
          : "/personalized-path";
        navigate(target, { replace: true });
      }, TIMING.redirect),
    ];

    return () => ids.forEach(clearTimeout);
  }, [navigate, sessionId]);

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo mark */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-10 border"
          style={{
            backgroundColor: "var(--primary, #1d5330)",
            borderColor: "rgba(42,115,71,0.45)",
          }}
        >
          <span
            className="app-em-gold"
            style={{ fontSize: 28, lineHeight: 1, fontStyle: "italic" }}
          >
            G
          </span>
        </div>

        {/* Steps */}
        <div className="w-full space-y-4 mb-8">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="flex items-center gap-3 transition-all duration-300"
              style={{
                opacity: stepVisible[i] ? 1 : 0,
                transform: stepVisible[i] ? "translateY(0)" : "translateY(6px)",
              }}
            >
              {/* Circle */}
              <div
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                style={{
                  borderColor: stepDone[i]
                    ? "var(--primary-bright, #2a7347)"
                    : "var(--border-color, rgba(0,0,0,0.12))",
                  backgroundColor: stepDone[i]
                    ? "var(--primary-bright, #2a7347)"
                    : "transparent",
                  transform: stepDone[i] ? "scale(1)" : "scale(0.85)",
                }}
              >
                {stepDone[i] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="#fff"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <span
                className="text-sm leading-snug transition-colors duration-200"
                style={{
                  color: stepDone[i]
                    ? "var(--color-text-primary, #1a1a1a)"
                    : "var(--color-text-muted)",
                  fontWeight: stepDone[i] ? 500 : 400,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Reveal */}
        <div
          className="w-full flex flex-col items-center transition-all duration-400"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
          }}
        >
          <div
            className="w-10 h-px mb-8"
            style={{ backgroundColor: "var(--border-color, rgba(0,0,0,0.1))" }}
          />
          <h1
            className="text-2xl font-extrabold text-center mb-2 tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            You&apos;re all set
          </h1>
          <p
            className="text-sm text-center leading-relaxed mb-8 max-w-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Full access is now active. Taking you to your path…
          </p>

          {/* Passive progress bar — shows redirect is imminent */}
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--ghost-bg, rgba(0,0,0,0.06))" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: "var(--primary-bright, #2a7347)",
                transition: `width ${TIMING.redirect - TIMING.reveal}ms linear`,
                width: revealed ? "100%" : "0%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
