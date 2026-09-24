import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import ParticleStage from "../ParticleStage";

const TOPICS = ["budgeting", "saving", "investing", "credit", "taxes"] as const;
const LINK_COUNT = TOPICS.length - 1;

/** A click anywhere on the globe, or on a label, sends a pulse through it. */
const CLICK_PULSE = 1.6;
const HOVER_PULSE = 0.6;

export default function HeroGlobe() {
  const { t } = useTranslation();
  const brainStageRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Record<string, HTMLElement | null>>({});
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const flowRef = useRef(0.15);
  const pulseRef = useRef(0);

  return (
    <div className="gzh-hero__globe">
      <div className="gzh-globe__backdrop" aria-hidden="true" />
      <div
        ref={brainStageRef}
        className="gzh-globe__stage"
        aria-hidden="true"
        onPointerDown={() => {
          pulseRef.current = CLICK_PULSE;
        }}
      >
        <div ref={canvasContainerRef} className="gzh-globe__canvas" />
        <svg className="gzh-globe__lines">
          {Array.from({ length: LINK_COUNT }, (_, i) => (
            <line
              key={i}
              className="gzh-globe__line"
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
            />
          ))}
        </svg>
        {TOPICS.map((key) => (
          <div
            key={key}
            className="gzh-hud"
            ref={(el) => {
              topicRefs.current[key] = el;
            }}
            onPointerEnter={() => {
              pulseRef.current = Math.max(pulseRef.current, HOVER_PULSE);
            }}
          >
            <span className="gzh-hud__dot" />
            <span className="gzh-hud__tag">
              {t(`welcome.hero.topics.${key}`)}
            </span>
          </div>
        ))}
        <ParticleStage
          canvasContainerRef={canvasContainerRef}
          brainStageRef={brainStageRef}
          topicRefs={topicRefs}
          lineRefs={lineRefs}
          flowRef={flowRef}
          pulseRef={pulseRef}
        />
      </div>
      <span className="gzh-globe__hint" aria-hidden="true">
        {t("welcome.hero.globeHint")}
      </span>
    </div>
  );
}
