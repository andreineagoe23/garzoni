import React from "react";
import { Link } from "react-router-dom";
import classNames from "classnames";

const Breadcrumbs = ({ items = [], className }) => {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={classNames(
        "flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-text,#6b7280)]",
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label + index}>
            {index > 0 && <span className="text-[color:var(--border-color,#d1d5db)]">/</span>}
            {isLast || !item.to ? (
              <span className="font-medium text-[color:var(--text-color,#111827)]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className="transition-colors hover:text-[color:var(--accent,#2563eb)]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
