import React, { Suspense, useState } from "react";

// three.js (122KB gz) is only worth downloading for users who'll actually see
// it animate — gate the lazy import itself behind prefers-reduced-motion so
// that chunk never gets requested for those visitors.
const ParticleGlobe = React.lazy(() => import("./ParticleGlobe"));

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
  );
}

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
  // Lazy initializer: read the media query synchronously on first render so
  // the `import("./ParticleGlobe")` call never fires for reduced-motion users
  // (an effect would run after the import was already kicked off).
  const [skipGlobe] = useState(prefersReducedMotion);

  const fallback = (
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
  );

  if (skipGlobe) {
    return fallback;
  }

  return (
    <Suspense fallback={fallback}>
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
