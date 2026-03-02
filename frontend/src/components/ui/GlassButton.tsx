import React from "react";

type GlassButtonVariant = "primary" | "active" | "success" | "danger" | "ghost";
type GlassButtonSize = "sm" | "md" | "lg" | "xl";

type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

const GlassButton = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
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
      "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--primary,#1d5330)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-gradient-to-r hover:from-[color:var(--primary,#1d5330)] hover:to-[color:var(--primary,#1d5330)]/90 hover:text-white hover:shadow-lg hover:shadow-[color:var(--primary,#1d5330)]/30 focus:ring-[color:var(--primary,#1d5330)]/40",
    active:
      "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:ring-[color:var(--primary,#1d5330)]/40",
    success:
      "border border-green-500/40 bg-[color:var(--card-bg,#ffffff)]/80 text-green-700 hover:border-green-500/60 hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600/90 hover:text-white hover:shadow-lg hover:shadow-green-500/30 focus:ring-green-500/40 [&>span:first-child]:!text-green-600 [&>span:first-child]:font-bold",
    danger:
      "border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)] hover:bg-[color:var(--error,#dc2626)] hover:text-white hover:shadow-md focus:ring-[color:var(--error,#dc2626)]/40",
    ghost:
      "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-[color:var(--primary,#1d5330)]/10 hover:text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]/40",
  };

  const disabledStyles = disabled
    ? "opacity-50 cursor-not-allowed pointer-events-none"
    : "";

  const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${className}`;

  const iconElement =
    typeof icon === "string" ? (
      <span
        className={variant === "success" ? "!text-green-600" : ""}
        style={variant === "success" ? { color: "#16a34a" } : {}}
      >
        {icon}
      </span>
    ) : icon ? (
      icon
    ) : null;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
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
