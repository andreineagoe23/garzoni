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
  const baseStyles = "rounded-3xl border border-border backdrop-blur-lg";

  const variantStyles: Record<
    NonNullable<GlassContainerProps["variant"]>,
    string
  > = {
    default: "bg-surface-card/95 shadow-xl shadow-black/10",
    subtle: "bg-surface-card/70 shadow-sm shadow-black/5",
    strong: "bg-surface-elevated/98 shadow-2xl shadow-black/15",
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
