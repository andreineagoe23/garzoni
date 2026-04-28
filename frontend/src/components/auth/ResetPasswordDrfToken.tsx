import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { confirmDrfPasswordReset } from "@garzoni/core";

/**
 * Completes password reset when the email link uses ?token=... (django-rest-passwordreset).
 * The classic uid/token flow uses {@link ResetPassword} instead.
 */
function ResetPasswordDrfToken() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!token.trim()) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmDrfPasswordReset(token.trim(), password);
      setMessage("Password updated. Redirecting to sign in…");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, unknown> | undefined;
        const detail =
          (typeof data?.detail === "string" && data.detail) ||
          (Array.isArray((data as { password?: string[] })?.password) &&
            (data as { password?: string[] }).password?.[0]) ||
          (typeof data?.token === "string" && data.token) ||
          err.response?.statusText;
        setError(
          detail || "Could not reset password. The link may have expired."
        );
      } else {
        setError("Could not reset password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Set a new password
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Enter a new password for your account. If you reached this page by
        mistake,{" "}
        <Link to="/forgot-password" className="text-amber-200 underline">
          request a new link
        </Link>
        .
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="mb-1 block text-sm text-gray-300">
            New password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="pw2" className="mb-1 block text-sm text-gray-300">
            Confirm password
          </label>
          <input
            id="pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-green-400">{message}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[color:var(--primary,#1d5330)] py-2 font-medium text-white hover:bg-[color:var(--primary-bright,#2a7347)] disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPasswordDrfToken;
