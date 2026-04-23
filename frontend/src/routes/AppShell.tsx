import React, { Suspense } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "contexts/AuthContext";
import Chatbot from "components/widgets/Chatbot";
import AppRoutes from "routes/AppRoutes";
import { Footer, Navbar } from "routes/lazyPages";

// Paths that are public but should show nav/footer only when authenticated.
const AUTH_CONDITIONAL_PATHS = [
  "/privacy-policy",
  "/cookie-policy",
  "/terms-of-service",
  "/financial-disclaimer",
  "/support",
];

type AppShellProps = {
  noNavbarPaths: string[];
  noFooterPaths: string[];
  noChatbotPaths: string[];
  isCourseFlowPath: boolean;
  fallbackNavbar: string;
  fallbackPage: string;
};

const AppShell = ({
  noNavbarPaths,
  noFooterPaths,
  noChatbotPaths,
  isCourseFlowPath,
  fallbackNavbar,
  fallbackPage,
}: AppShellProps) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isLegalPath = AUTH_CONDITIONAL_PATHS.includes(location.pathname);
  const isLegalAndUnauth = isLegalPath && !isAuthenticated;
  const matchesAnyPathPrefix = (prefixes: string[]) =>
    prefixes.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    );

  const hasNavbar =
    !isCourseFlowPath &&
    !isLegalAndUnauth &&
    ((isLegalPath && isAuthenticated) || !matchesAnyPathPrefix(noNavbarPaths));
  const hasFooter =
    !matchesAnyPathPrefix(noFooterPaths) &&
    !isCourseFlowPath &&
    !isLegalAndUnauth;

  return (
    <div
      className={[
        "app-container",
        "min-h-screen flex flex-col",
        matchesAnyPathPrefix(noChatbotPaths) ? "nochatbot" : "",
      ]
        .join(" ")
        .trim()}
    >
      {hasNavbar && (
        <Suspense fallback={<div className="p-4">{fallbackNavbar}</div>}>
          <Navbar />
        </Suspense>
      )}
      <div className="app-layout w-full flex-1 flex flex-col p-0">
        <main
          className="content flex-1"
          style={hasNavbar ? { paddingTop: "88px" } : undefined}
        >
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-text,#6b7280)]">
                {fallbackPage}
              </div>
            }
          >
            <AppRoutes />
          </Suspense>
        </main>
        {!noChatbotPaths.includes(location.pathname) &&
          !isCourseFlowPath &&
          !isLegalAndUnauth && <Chatbot />}
        {hasFooter && (
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default AppShell;
