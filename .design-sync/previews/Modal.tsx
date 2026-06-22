import React, { useEffect } from "react";
import { Modal } from "@garzoni/web";

export const Open = () => {
  // Modal portals to document.body, so it themes off the document root, not a
  // wrapper. Set the dark theme (the app's default) to show the dark-glass look.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.style.background = "#0b0f14";
  }, []);
  return (
    <Modal isOpen title="End apprenticeship contract?" onClose={() => {}}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        This records the contract for Giovanni di Maestro as concluded on 12
        March 1573. The entry will remain in the archive but can no longer be
        edited.
      </p>
    </Modal>
  );
};
