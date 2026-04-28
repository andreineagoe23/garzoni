import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
const ProtectedRoute = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null => {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="app-page flex items-center justify-center px-6">
        <div className="app-card flex flex-col items-center gap-4 px-8 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a7347] border-t-transparent" />
          <div>
            <p className="text-base font-semibold text-content-primary">
              Verifying...
            </p>
            <p className="mt-1 text-sm text-content-muted">
              Please hold on while we prepare your experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
