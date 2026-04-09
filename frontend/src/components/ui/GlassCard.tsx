import React from "react";

type GlassCardPadding = "none" | "sm" | "md" | "lg" | "xl";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  padding?: GlassCardPadding;
  children: React.ReactNode;
};

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    { children, className = "", hover = true, padding = "md", ...props },
    ref
  ) => {
    const baseStyles =
      "relative overflow-hidden rounded-3xl border border-border bg-surface-card/95 shadow-xl shadow-black/10 backdrop-blur-lg transition-all";

    const paddingStyles = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "px-6 py-8",
      xl: "px-8 py-10",
    };

    const hoverStyles = hover ? "hover:shadow-xl hover:shadow-black/12" : "";

    const combinedClassName = `${baseStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`;

    return (
      <div
        ref={ref}
        className={combinedClassName}
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;
