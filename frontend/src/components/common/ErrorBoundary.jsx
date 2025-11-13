// ErrorBoundary.js
import React from "react";

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Widget Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl border border-[color:var(--warning,#f59e0b)]/40 bg-[color:var(--warning,#f59e0b)]/10 px-4 py-4 text-sm text-[color:var(--warning,#b45309)] shadow-inner shadow-[color:var(--warning,#f59e0b)]/20">
          <p className="font-semibold">
            Something went wrong while loading this section.
          </p>
          <p className="mt-1 text-[color:var(--muted-text,#6b7280)]">
            Please refresh the page or try again later. If the problem
            persists, contact support.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
