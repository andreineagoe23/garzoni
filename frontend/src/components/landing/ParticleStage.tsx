import React, { Suspense } from "react";

const ParticleGlobe = React.lazy(() => import("./ParticleGlobe"));

export default function ParticleStage({
  canvasContainerRef,
  brainStageRef,
  topicRefs,
  lineRefs,
  flowRef,
}) {
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
            background: "#0B0F14",
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
      />
    </Suspense>
  );
}
