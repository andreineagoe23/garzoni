import React from "react";

export type GlassCardPadding = "none" | "sm" | "md" | "lg" | "xl";

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
    const baseStyles = "app-card relative overflow-hidden transition-all";

    // One card padding vocabulary — the same three densities `.app-card`
    // exposes, which in turn come from packages/tokens (so these match the
    // mobile `Card`/`GlassCard` scale). `xl` keeps a roomier hero density for
    // the few marketing-ish surfaces that need it.
    const paddingStyles: Record<GlassCardPadding, string> = {
      none: "",
      sm: "app-card--pad-sm",
      md: "app-card--pad",
      lg: "app-card--pad-lg",
      xl: "p-8",
    };

    const hoverStyles = hover ? "hover:shadow-xl hover:shadow-black/12" : "";

    const combinedClassName = `${baseStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`;

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;
