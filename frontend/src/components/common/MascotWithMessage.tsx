import React from "react";
import MascotMedia from "components/common/MascotMedia";
import { useMascotMessage, type MascotMood, type MascotType } from "hooks/useMascotMessage";

type MascotWithMessageProps = {
  mood: MascotMood;
  /** If provided, keep the same mascot while mood/message changes. */
  fixedMascot?: MascotType;
  /** When true, rotate through message pool using rotationKey */
  rotateMessages?: boolean;
  /** Key for deterministic message rotation (e.g. interaction count) */
  rotationKey?: number;
  className?: string;
  mascotClassName?: string;
  /** If true, render message in a separate paragraph below mascot */
  showMessage?: boolean;
  /** Speech bubble vs plain text */
  messageStyle?: "bubble" | "plain";
  /** Optional override for the default pooled message (e.g. lesson/section insight). */
  customMessage?: string;
};

const MascotWithMessage = ({
  mood,
  fixedMascot,
  rotateMessages = false,
  rotationKey = 0,
  className,
  mascotClassName = "h-32 w-32 object-contain",
  showMessage = true,
  messageStyle = "bubble",
  customMessage,
}: MascotWithMessageProps) => {
  const { mascot, message: pooledMessage } = useMascotMessage(mood, {
    rotateMessages,
    rotationKey,
    mascotOverride: fixedMascot,
  });
  const message = customMessage || pooledMessage;

  return (
    <div className={`mt-3 flex justify-center text-center ${className ?? ""}`}>
      <div className="relative h-40 w-full max-w-[14rem]">
        {showMessage &&
          (messageStyle === "plain" ? (
            <p className="absolute top-0 right-0 mb-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              {message}
            </p>
          ) : (
            <div className="absolute right-0 top-0">
              <div className="tooltip">{message}</div>
            </div>
          ))}

        <div className="absolute bottom-0 left-0">
          <MascotMedia mascot={mascot} className={mascotClassName} />
        </div>
      </div>
    </div>
  );
};

export default MascotWithMessage;
