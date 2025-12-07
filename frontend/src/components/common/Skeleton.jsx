import React from "react";
import classNames from "classnames";

const Skeleton = ({ className, rounded = "md" }) => (
  <div
    className={classNames(
      "animate-pulse bg-[color:var(--skeleton,#e5e7eb)]/80",
      {
        "rounded-md": rounded === "md",
        "rounded-full": rounded === "full",
        "rounded-lg": rounded === "lg",
      },
      className
    )}
  />
);

export const SkeletonGroup = ({ children, className }) => (
  <div className={classNames("animate-pulse space-y-3", className)}>
    {children}
  </div>
);

export default Skeleton;
