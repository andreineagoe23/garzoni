import React, { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  animated?: boolean;
  className?: string;
};

const MEDIA_BASE = BACKEND_URL.replace(/\/api\/?$/, "");

/** Bump when you replace mascot videos in backend/media/mascots/ so browsers load the new files. */
const MASCOT_VIDEO_VERSION = 2;

const MASCOT_MEDIA: Record<
  MascotType,
  { video: string; image: string; alt: string }
> = {
  owl: {
    video: `${MEDIA_BASE}/media/mascots/Owl-Mascot-${MASCOT_VIDEO_VERSION}.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-owl.png`,
    alt: "Owl mascot",
  },
  bull: {
    video: `${MEDIA_BASE}/media/mascots/Bull-Mascot-${MASCOT_VIDEO_VERSION}.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bull.png`,
    alt: "Bull mascot",
  },
  bear: {
    video: `${MEDIA_BASE}/media/mascots/Bear-Mascot-${MASCOT_VIDEO_VERSION}.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bear.png`,
    alt: "Bear mascot",
  },
};

const MascotMedia = ({ mascot, className }: MascotMediaProps) => {
  const [useFallback, setUseFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { video, image, alt } = MASCOT_MEDIA[mascot];

  useEffect(() => {
    const el = videoRef.current;
    if (!el || useFallback) return;
    const play = () => el.play().catch(() => {});
    el.addEventListener("loadeddata", play);
    if (el.readyState >= 2) play();
    return () => el.removeEventListener("loadeddata", play);
  }, [video, useFallback]);

  if (useFallback) {
    return (
      <img
        src={image}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      src={video}
      muted
      loop
      playsInline
      autoPlay
      aria-label={alt}
      onError={() => setUseFallback(true)}
      style={{ mixBlendMode: "multiply" }}
    >
      <source src={video} type="video/mp4" />
    </video>
  );
};

export default MascotMedia;
