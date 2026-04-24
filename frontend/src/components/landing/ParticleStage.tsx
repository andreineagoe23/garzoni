import React, { Suspense } from "react";

const ParticleGlobe = React.lazy(() => import("./ParticleGlobe"));

export default function ParticleStage({
  canvasContainerRef,
  brainStageRef,
  topicRefs,
  lineRefs,
  flowRef,
  lightBackdrop = false,
}: {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  brainStageRef: React.RefObject<HTMLDivElement | null>;
  topicRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  lineRefs: React.MutableRefObject<Array<SVGLineElement | null>>;
  flowRef: React.MutableRefObject<number>;
  lightBackdrop?: boolean;
}) {
  const fallbackBg = "transparent";

  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: fallbackBg,
            pointerEvents: "none",
          }}
        />
      }
    >
      <ParticleGlobe
        canvasContainerRef={canvasContainerRef}
        brainStageRef={brainStageRef}
        topicRefs={topicRefs}
        lineRefs={lineRefs}
        flowRef={flowRef}
        lightBackdrop={lightBackdrop}
      />
    </Suspense>
  );
}
