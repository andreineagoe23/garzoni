import React, { useMemo, useState } from "react";
import { BACKEND_URL } from "services/backendUrl";

type MascotType = "owl" | "bull" | "bear";

type MascotMediaProps = {
  mascot: MascotType;
  animated?: boolean;
  className?: string;
};

const MEDIA_BASE = BACKEND_URL.replace(/\/api\/?$/, "");

const MASCOT_MEDIA: Record<
  MascotType,
  { video: string; image: string; alt: string }
> = {
  owl: {
    video: `${MEDIA_BASE}/media/mascots/Owl-Mascot.mov`,
    image: `${MEDIA_BASE}/media/mascots/monevo-owl.png`,
    alt: "Owl mascot" },
  bull: {
    video: `${MEDIA_BASE}/media/mascots/Bull-Mascot.mov`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bull.png`,
    alt: "Bull mascot" },
  bear: {
    video: `${MEDIA_BASE}/media/mascots/Bear-Mascot.mov`,
    image: `${MEDIA_BASE}/media/mascots/monevo-bear.png`,
    alt: "Bear mascot" } };

const MascotMedia = ({ mascot, animated = true, className }: MascotMediaProps) => {
  const { video, image, alt } = MASCOT_MEDIA[mascot];
  const [videoFailed, setVideoFailed] = useState(false);
  const shouldAnimate = animated && !videoFailed;
  const fallback = useMemo(
    () => <img src={image} alt={alt} className={className} />,
    [alt, className, image]
  );

  if (shouldAnimate) {
    return (
      <video
        className={className}
        autoPlay
        loop
        muted
        playsInline
        poster={image}
        onError={() => setVideoFailed(true)}
      >
        <source src={video} type="video/quicktime" />
        {fallback}
      </video>
    );
  }

  return fallback;
};

export default MascotMedia;
