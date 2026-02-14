import React, { useState } from "react";
import { BACKEND_URL } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  animated?: boolean;
  className?: string;
};

const MEDIA_BASE = BACKEND_URL.replace(/\/api\/?$/, "");

const MASCOT_MEDIA: Record<MascotType, { video: string; image: string; alt: string }> = {
  owl: {
    video: `${MEDIA_BASE}/media/mascots/Owl-Mascot.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-owl.png`,
    alt: "Owl mascot",
  },
  bull: {
    video: `${MEDIA_BASE}/media/mascots/Bull-Mascot.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bull.png`,
    alt: "Bull mascot",
  },
  bear: {
    video: `${MEDIA_BASE}/media/mascots/Bear-Mascot.mp4`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bear.png`,
    alt: "Bear mascot",
  },
};

const MascotMedia = ({ mascot, animated = true, className }: MascotMediaProps) => {
  const [useFallback, setUseFallback] = useState(false);
  const { video, image, alt } = MASCOT_MEDIA[mascot];

  const handleVideoError = () => {
    setUseFallback(true);
  };

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
      className={className}
      autoPlay={animated}
      loop={animated}
      muted
      playsInline
      aria-label={alt}
      onError={handleVideoError}
    >
      <source src={video} type="video/mp4" />
    </video>
  );
};

export default MascotMedia;
