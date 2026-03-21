import React, { type CSSProperties, type HTMLAttributes } from "react";

type GlassContainerProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "subtle" | "strong";
};

const GlassContainer = ({
  children,
  className = "",
  variant = "default",
  style,
  ...props
}: GlassContainerProps) => {
  // Theme-aware border: darker in light mode, lighter in dark mode
  const borderStyle =
    "border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))]";
  const baseStyles = `rounded-3xl ${borderStyle} backdrop-blur-lg`;

  const variantStyles: Record<
    NonNullable<GlassContainerProps["variant"]>,
    string
  > = {
    default:
      "bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]",
    subtle:
      "bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/70 shadow-sm shadow-[color:var(--shadow-color,rgba(0,0,0,0.05))]",
    strong:
      "bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/98 shadow-2xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.15))]",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`;

  const glassStyle: CSSProperties = {
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    ...(style as CSSProperties | undefined),
  };

  return (
    <div className={combinedClassName} style={glassStyle} {...props}>
      {children}
    </div>
  );
};

export default GlassContainer;
