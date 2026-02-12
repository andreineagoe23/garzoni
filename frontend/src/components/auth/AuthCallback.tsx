/**
 * Handles redirect from backend after Google OAuth: reads access token from hash,
 * completes login in AuthContext, then navigates to the intended page.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    let access = params.get("access");
    const next = params.get("next") || "all-topics";

    // URLSearchParams decodes once; some proxies may double-encode
    if (access && access.includes("%2")) {
      try {
        access = decodeURIComponent(access);
      } catch {
        /* use as-is */
      }
    }

    if (!access || !access.trim()) {
      setError("Sign-in was interrupted. Please try again from the login page.");
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await completeOAuthLogin(access!.trim());
      if (cancelled) return;
      if (result.success) {
        const path = next.startsWith("/") ? next : `/${next}`;
        navigate(path, { replace: true });
      } else {
        setError(result.error || "Login failed");
        navigate("/login", { replace: true, state: { oauthError: result.error } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeOAuthLogin, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--bg-color)] px-4">
        <p className="text-center text-[color:var(--error)]">{error}</p>
        <Link
          to="/login"
          className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-color)]">
      <p className="text-[color:var(--muted-text)]">Signing you in…</p>
    </div>
  );
}
