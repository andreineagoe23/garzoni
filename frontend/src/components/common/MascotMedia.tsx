import React from "react";
import { getMediaBaseUrl } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  className?: string;
};

const MASCOT_FILES: Record<MascotType, { file: string; alt: string }> = {
  owl: { file: "garzoni-owl.png", alt: "Owl mascot" },
  bull: { file: "garzoni-bull.png", alt: "Bull mascot" },
  bear: { file: "garzoni-bear.png", alt: "Bear mascot" },
};

const MascotMedia = ({ mascot, className }: MascotMediaProps) => {
  const base = getMediaBaseUrl();
  const { file, alt } = MASCOT_FILES[mascot];
  const image = `${base}/media/mascots/${file}`;
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
