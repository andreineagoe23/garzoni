import React from "react";
import { BACKEND_URL } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  animated?: boolean;
  className?: string;
};

const MEDIA_BASE = BACKEND_URL.replace(/\/api\/?$/, "");

const MASCOT_MEDIA: Record<MascotType, { video: string; alt: string }> = {
  owl: { video: `${MEDIA_BASE}/media/mascots/Owl-Mascot.mov`, alt: "Owl mascot" },
  bull: { video: `${MEDIA_BASE}/media/mascots/Bull-Mascot.mov`, alt: "Bull mascot" },
  bear: { video: `${MEDIA_BASE}/media/mascots/Bear-Mascot.mov`, alt: "Bear mascot" },
};

const MascotMedia = ({ mascot, animated = true, className }: MascotMediaProps) => {
  const { video, alt } = MASCOT_MEDIA[mascot];

  return (
    <video
      className={className}
      autoPlay={animated}
      loop={animated}
      muted
      playsInline
      aria-label={alt}
    >
      <source src={video} type="video/quicktime" />
    </video>
  );
};

export default MascotMedia;
