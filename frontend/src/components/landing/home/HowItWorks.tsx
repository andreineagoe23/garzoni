import React, { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BudgetScreen from "./phone/BudgetScreen";
import GoalScreen from "./phone/GoalScreen";
import QuizScreen from "./phone/QuizScreen";
import StreakScreen from "./phone/StreakScreen";

const STEPS = ["lessons", "streaks", "practise", "path"] as const;
const WIDE_MIN = 900;
const PHONE_HEIGHT = 620;

/** Uniform scale that fits the 300×620 phone in the viewport, never below half size. */
const phoneScale = () =>
  Math.max(0.5, Math.min(1, (window.innerHeight - 116) / PHONE_HEIGHT));

export default function HowItWorks() {
  const { t } = useTranslation();
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [step, setStep] = useState(0);
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE_MIN);
  const [scale, setScale] = useState(phoneScale);

  useEffect(() => {
    let frame = 0;
    // The active step is the one whose centre sits closest to the viewport's.
    const measure = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const distance = Math.abs(r.top + r.height / 2 - mid);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      setStep(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onResize = () => {
      setWide(window.innerWidth >= WIDE_MIN);
      setScale(phoneScale());
      onScroll();
    };
    onResize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const screen = (index: number, content: React.ReactNode, tight = false) => {
    const state = step === index ? "active" : step > index ? "before" : "after";
    return (
      <div
        className={`gzh-screen${tight ? " gzh-screen--tight" : ""}`}
        data-state={state}
        // Hidden screens stay out of the tab order. Set on the element: the
        // installed React types don't know the `inert` attribute yet.
        ref={(el) => {
          if (el) el.inert = state !== "active";
        }}
      >
        {content}
      </div>
    );
  };

  return (
    <section id="how" className="gzh-how">
      <div className="gzh-container gzh-how__inner">
        <div className="gzh-how__head gzh-rise">
          <h2 className="gzh-h2 gzh-h2--how">
            <Trans
              i18nKey="welcome.how.title"
              components={{
                accent: <span key="accent" className="gzh-accent" />,
              }}
            />
          </h2>
          <p className="gzh-sub">{t("welcome.how.body")}</p>
        </div>
        <div className={`gzh-how__grid${wide ? " gzh-how__grid--wide" : ""}`}>
          <div className="gzh-steps">
            {STEPS.map((key, i) => (
              <div
                key={key}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className="gzh-step"
                data-active={!wide || step === i}
              >
                <span className="gzh-step__num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="gzh-step__title">
                  {t(`welcome.how.steps.${key}.title`)}
                </h3>
                <p className="gzh-step__body">
                  {t(`welcome.how.steps.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
          {wide && (
            <div className="gzh-phone-col">
              <div className="gzh-phone-sticky">
                <div
                  className="gzh-phone"
                  data-step={step}
                  style={{
                    transform: `scale(${scale})`,
                    marginBottom: `${(-(PHONE_HEIGHT * (1 - scale))).toFixed(0)}px`,
                  }}
                >
                  <div className="gzh-phone__screen">
                    <div className="gzh-phone__notch" aria-hidden="true" />
                    {screen(0, <QuizScreen />)}
                    {screen(1, <StreakScreen />)}
                    {screen(2, <BudgetScreen />, true)}
                    {screen(3, <GoalScreen />, true)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
