import React from "react";
import classNames from "classnames";

type SkeletonProps = {
  className?: string;
  rounded?: "md" | "lg" | "full";
};

const Skeleton = ({ className, rounded = "md" }: SkeletonProps) => (
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

type SkeletonGroupProps = {
  children: React.ReactNode;
  className?: string;
};

export const SkeletonGroup = ({ children, className }: SkeletonGroupProps) => (
  <div className={classNames("animate-pulse space-y-3", className)}>
    {children}
  </div>
);

export default Skeleton;
