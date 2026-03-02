import React, { useState } from "react";
import Modal from "./Modal";
import GlassButton from "./GlassButton";

const config = {
  title: "UI/Modal",
  component: Modal,
  parameters: {
    docs: {
      description: {
        story:
          "Modal dialog with Escape-to-close. Keyboard: Esc closes, Tab cycles focus within the page.",
      },
    },
  },
};

export default config;

export const Default = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="p-6">
      <GlassButton onClick={() => setIsOpen(true)}>Open modal</GlassButton>
      <Modal
        isOpen={isOpen}
        title="Example modal"
        onClose={() => setIsOpen(false)}
      >
        <p className="text-sm text-white/70">
          Use this modal for confirmations or focused tasks.
        </p>
      </Modal>
    </div>
  );
};
