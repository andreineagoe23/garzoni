/**
 * RevenueCat Customer Center — web implementation.
 *
 * Opens the RC-hosted Customer Center modal where users can:
 *   - View their active subscriptions
 *   - Cancel or change plans
 *   - Request refunds
 *   - Get support
 *
 * The Customer Center is opened via rc.showCustomerCenter() which renders a
 * managed overlay inside the current page — no redirect required.
 *
 * Usage:
 *   <RevenueCatCustomerCenter userId={user.id.toString()} />
 */

import React, { useCallback, useState } from "react";
import {
  configureRevenueCat,
  rcShowCustomerCenter,
} from "services/revenueCatService";
import { GlassButton } from "components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueCatCustomerCenterProps {
  /** Stable user identifier — your Django user PK as a string. */
  userId: string;
  /** Optional label override for the trigger button. */
  label?: string;
  /** Pass-through class names to the button wrapper. */
  className?: string;
  /** Variant forwarded to GlassButton. Defaults to "ghost". */
  variant?: "primary" | "ghost" | "active";
  /** Size forwarded to GlassButton. Defaults to "md". */
  size?: "sm" | "md" | "lg";
  /** Called after the Customer Center is closed by the user. */
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RevenueCatCustomerCenter: React.FC<RevenueCatCustomerCenterProps> = ({
  userId,
  label = "Manage subscription",
  className,
  variant = "ghost",
  size,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      // Ensure SDK is initialized (idempotent if already configured).
      configureRevenueCat(userId);
      await rcShowCustomerCenter();
      onClose?.();
    } catch (err) {
      const rcErr = err as { message?: string };
      const message =
        rcErr?.message || "Unable to open Customer Center. Please try again.";
      setError(message);
      console.error("[RevenueCat CustomerCenter] error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, onClose]);

  return (
    <div className={className}>
      <GlassButton
        variant={variant}
        size={size}
        loading={loading}
        disabled={loading}
        onClick={() => void handleOpen()}
      >
        {loading ? "Opening…" : label}
      </GlassButton>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--error,#dc2626)]">
          {error}
        </p>
      )}
    </div>
  );
};

export default RevenueCatCustomerCenter;
