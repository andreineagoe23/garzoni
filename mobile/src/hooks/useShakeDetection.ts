import { useEffect, useRef } from "react";

const SHAKE_THRESHOLD = 2.5;
const SHAKE_WINDOW_MS = 600;
const SHAKE_MIN_HITS = 3;

type Options = {
  onShake: () => void;
  enabled?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccelerometer = any;

export function useShakeDetection({ onShake, enabled = true }: Options) {
  const hitsRef = useRef(0);
  const windowStartRef = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;

    let sub: { remove: () => void } | null = null;

    // Import the Accelerometer subpath to avoid expo-sensors/index loading
    // Pedometer (which crashes on iOS simulator / unregistered dev clients).
    import("expo-sensors/build/Accelerometer")
      .then((mod: AnyAccelerometer) => {
        const Acc = mod.Accelerometer ?? mod.default;
        if (!Acc) return;
        Acc.setUpdateInterval(100);
        sub = Acc.addListener(
          ({ x, y, z }: { x: number; y: number; z: number }) => {
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            if (magnitude > SHAKE_THRESHOLD) {
              const now = Date.now();
              if (now - windowStartRef.current > SHAKE_WINDOW_MS) {
                hitsRef.current = 1;
                windowStartRef.current = now;
              } else {
                hitsRef.current += 1;
              }
              if (hitsRef.current >= SHAKE_MIN_HITS) {
                hitsRef.current = 0;
                onShakeRef.current();
              }
            }
          },
        );
      })
      .catch(() => {
        // Native accelerometer unavailable (simulator or stale dev-client build).
      });

    return () => {
      sub?.remove();
    };
  }, [enabled]);
}
