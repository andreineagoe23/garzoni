import React from "react";
import { BACKEND_URL } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  className?: string;
};

const MEDIA_BASE = BACKEND_URL.replace(/\/api\/?$/, "");

const MASCOT_MEDIA: Record<MascotType, { image: string; alt: string }> = {
  owl: {
    image: `${MEDIA_BASE}/media/mascots/monevo-owl.png`,
    alt: "Owl mascot",
  },
  bull: {
    image: `${MEDIA_BASE}/media/mascots/monevo-bull.png`,
    alt: "Bull mascot",
  },
  bear: {
    image: `${MEDIA_BASE}/media/mascots/monevo-bear.png`,
    alt: "Bear mascot",
  },
};

const MascotMedia = ({ mascot, className }: MascotMediaProps) => {
  const { image, alt } = MASCOT_MEDIA[mascot];
  return (
    <img
      src={image}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
};

export default MascotMedia;
