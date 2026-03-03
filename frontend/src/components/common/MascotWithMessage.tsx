import React from "react";
import MascotMedia from "components/common/MascotMedia";
import { useMascotMessage, type MascotMood } from "hooks/useMascotMessage";

type MascotWithMessageProps = {
  mood: MascotMood;
  /** When true, rotate through message pool using rotationKey */
  rotateMessages?: boolean;
  /** Key for deterministic message rotation (e.g. interaction count) */
  rotationKey?: number;
  className?: string;
  mascotClassName?: string;
  /** If true, render message in a separate paragraph below mascot */
  showMessage?: boolean;
};

const MascotWithMessage = ({
  mood,
  rotateMessages = false,
  rotationKey = 0,
  className,
  mascotClassName = "h-24 w-24 object-contain",
  showMessage = true,
}: MascotWithMessageProps) => {
  const { mascot, message } = useMascotMessage(mood, {
    rotateMessages,
    rotationKey,
  });

  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className ?? ""}`}>
      <MascotMedia mascot={mascot} className={mascotClassName} />
      {showMessage && (
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {message}
        </p>
      )}
    </div>
  );
};

export default MascotWithMessage;
