/**
 * Handles redirect from backend after Google OAuth: reads access token from hash,
 * completes login in AuthContext, then navigates to the intended page.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access = params.get("access");
    const next = params.get("next") || "all-topics";

    if (!access) {
      setError("Missing access token");
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await completeOAuthLogin(access);
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
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-color)]">
        <p className="text-[color:var(--error)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-color)]">
      <p className="text-[color:var(--muted-text)]">Signing you in…</p>
    </div>
  );
}
