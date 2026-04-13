import React from "react";
import { mascotImageUrl } from "@garzoni/core";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  className?: string;
};

const MASCOT_FILES: Record<MascotType, { alt: string }> = {
  owl: { alt: "Owl mascot" },
  bull: { alt: "Bull mascot" },
  bear: { alt: "Bear mascot" },
};

const MascotMedia = ({ mascot, className }: MascotMediaProps) => {
  const { alt } = MASCOT_FILES[mascot];
  const image = mascotImageUrl(mascot, { width: 384 });
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
