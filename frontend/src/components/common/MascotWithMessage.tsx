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
      {/* Mobile: single row – small mascot left, bubble right (containerized, centered, limited width) */}
      <div className="flex w-full max-w-full items-center justify-center gap-2 py-1 lg:hidden">
        <MascotMedia
          mascot={mascot}
          className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
        />
        {showMessage && message &&
          (messageStyle === "plain" ? (
            <p className="tooltip--inline-wrapper text-xs text-[color:var(--muted-text,#6b7280)]">
              {message}
            </p>
          ) : (
            <div className="tooltip tooltip--inline tooltip--inline-wrapper">
              {message}
            </div>
          ))}
      </div>

      {/* Desktop: original layout (bubble top-right, mascot bottom-left) */}
      <div className="relative hidden h-40 w-full max-w-[14rem] lg:block">
        {showMessage &&
          (messageStyle === "plain" ? (
            <p className="absolute right-0 top-0 mb-2 text-xs text-[color:var(--muted-text,#6b7280)]">
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
