import React, { Suspense, useEffect, useMemo } from "react";

const ParticleGlobe = React.lazy(() => import("./ParticleGlobe"));

function getPrefersReducedMotion() {
  return Boolean(
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  );
}

function getIsLowPerfDevice() {
  const saveData = Boolean(navigator.connection?.saveData);
  const lowCpu =
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency <= 4;
  const lowMem =
    typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;

  return saveData || lowCpu || lowMem;
}

export default function ParticleStage({
  canvasContainerRef,
  brainStageRef,
  topicRefs,
  lineRefs,
  flowRef,
}) {
  const prefersReducedMotion = useMemo(() => getPrefersReducedMotion(), []);
  const isLowPerf = useMemo(() => getIsLowPerfDevice(), []);
  const allow = !(prefersReducedMotion || isLowPerf);

  useEffect(() => {
    if (allow) return undefined;

    // If we don't mount the 3D globe, the HUD overlay would otherwise sit at (0,0).
    // Hide it to keep the stage visually clean on low-perf / reduced-motion devices.
    const topicEls = Object.values(topicRefs?.current || {});
    const lineEls = lineRefs?.current || [];

    topicEls.forEach((el) => {
      if (!el) return;
      el.style.opacity = "0";
    });

    lineEls.forEach((el) => {
      if (!el) return;
      el.style.opacity = "0";
    });

    return () => {
      topicEls.forEach((el) => {
        if (!el) return;
        el.style.opacity = "";
      });

      lineEls.forEach((el) => {
        if (!el) return;
        el.style.opacity = "";
      });
    };
  }, [allow, lineRefs, topicRefs]);

  if (!allow) {
    return (
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
    );
  }

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
