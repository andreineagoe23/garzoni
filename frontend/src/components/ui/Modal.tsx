import React, { useEffect } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

const Modal = ({ isOpen, title, onClose, children }: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[color:var(--card-bg,#15191E)]/95 p-6 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/50"
          >
            Close
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
