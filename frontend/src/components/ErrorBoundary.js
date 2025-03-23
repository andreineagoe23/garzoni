// ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Widget Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-warning">
          Widget failed to load. Please try refreshing the page.
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;