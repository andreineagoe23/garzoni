import React from "react";

export type FormNoticeVariant = "error" | "success";

// Canonical form-level alert/notice. Replaces the per-form hand-rolled boxes so
// every auth/form surface uses one styling + a11y contract. Colors come from the
// --color-* token layer (no hardcoded hex / legacy var fallbacks).
const VARIANT: Record<
  FormNoticeVariant,
  { box: string; role: "alert" | "status"; live: "assertive" | "polite" }
> = {
  // NB: Tailwind's `/opacity` modifier doesn't apply to an arbitrary var() color,
  // so the tinted bg/border are built with color-mix (which the per-form boxes this
  // replaces never actually rendered — they fell back to a plain gray border).
  error: {
    box: "border-[color-mix(in_srgb,var(--color-state-error)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-state-error)_10%,transparent)] text-[color:var(--color-state-error)]",
    role: "alert",
    live: "assertive",
  },
  success: {
    box: "border-[color-mix(in_srgb,var(--color-brand-primary-hover)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-primary)_10%,transparent)] text-[color:var(--color-brand-primary-hover)]",
    role: "status",
    live: "polite",
  },
};

type FormNoticeProps = {
  variant?: FormNoticeVariant;
  /** Extra classes for layout (margins, width, child spacing). */
  className?: string;
  children: React.ReactNode;
};

const FormNotice = ({
  variant = "error",
  className = "",
  children,
}: FormNoticeProps) => {
  const v = VARIANT[variant];
  return (
    <div
      role={v.role}
      aria-live={v.live}
      className={`rounded-lg border px-4 py-3 text-sm ${v.box} ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export default FormNotice;
