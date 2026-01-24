import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { useTranslation } from "react-i18next";

const ProtectedRoute = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null => {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();
  const { t } = useTranslation("auth");

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div
          className="flex flex-col items-center gap-4 rounded-2xl bg-slate-900/80 px-8 py-10 text-center shadow-2xl shadow-black/40 backdrop-blur"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary,#2563eb)] border-t-transparent" />
          <div>
            <p className="text-base font-semibold text-white">
              {t("protectedRoute.verifying")}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {t("protectedRoute.subtitle", {
                defaultValue:
                  "Please hold on while we prepare your experience.",
              })}
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
