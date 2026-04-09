import React from "react";

type GlassButtonVariant = "primary" | "active" | "success" | "danger" | "ghost";
type GlassButtonSize = "sm" | "md" | "lg" | "xl";

type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  icon?: React.ReactNode;
  /** Shows busy state and disables the button. */
  loading?: boolean;
  children: React.ReactNode;
};

const GlassButton = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  type = "button",
  icon,
  ...props
}: GlassButtonProps) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10";

  const sizeStyles = {
    sm: "px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs",
    md: "px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm",
    lg: "px-4 py-2 text-sm sm:px-5 sm:py-2.5",
    xl: "px-5 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base",
  };

  const variantStyles = {
    primary:
      "border border-border bg-surface-card/80 text-brand-primary hover:border-brand-primary/60 hover:bg-brand-primary hover:text-content-inverse hover:shadow-lg hover:shadow-brand-primary/30 focus:ring-brand-primary/40",
    active:
      "bg-gradient-to-r from-brand-primary to-brand-primary/90 text-content-inverse shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40 focus:ring-brand-primary/40",
    success:
      "border border-state-success/40 bg-surface-card/80 text-state-success hover:border-state-success/60 hover:bg-state-success hover:text-content-inverse hover:shadow-lg hover:shadow-state-success/30 focus:ring-state-success/40 [&>span:first-child]:!text-state-success [&>span:first-child]:font-bold",
    danger:
      "border border-state-error/40 bg-state-error/10 text-state-error hover:bg-state-error hover:text-content-inverse hover:shadow-md focus:ring-state-error/40",
    ghost:
      "border border-border bg-surface-card/70 text-content-muted hover:border-brand-primary/60 hover:bg-brand-primary/10 hover:text-brand-primary focus:ring-brand-primary/40",
  };

  const isDisabled = disabled || loading;
  const disabledStyles = isDisabled
    ? "opacity-50 cursor-not-allowed pointer-events-none"
    : "";

  const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${className}`;

  const iconElement =
    typeof icon === "string" ? (
      <span className={variant === "success" ? "!text-state-success" : ""}>
        {icon}
      </span>
    ) : icon ? (
      icon
    ) : null;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={combinedClassName}
      style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      {...props}
    >
      {iconElement}
      {children}
    </button>
  );
};

export default GlassButton;
