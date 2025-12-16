import React, { useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "services/backendUrl";
import { useNavigate } from "react-router-dom";
import logo from "assets/logo/monevo-logo-png.png";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${BACKEND_URL}/password-reset/`, {
        email,
      });
      setMessage(
        response.data.message || "Reset link sent. Please check your inbox."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.detail ||
          "An error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[color:var(--bg-color,#0f172a)] transition-colors">
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/20 via-transparent to-transparent" />
      <div className="relative w-full max-w-lg px-6 py-12 sm:px-10">
        <div
          className="flex flex-col items-center rounded-2xl border border-[color:var(--border-color,#1f2937)] bg-[color:var(--card-bg,#ffffff)] px-6 py-10 shadow-2xl shadow-black/20 backdrop-blur transition-colors"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <img
            src={logo}
            alt="Monevo logo"
            className="mb-6 h-12 w-auto"
            loading="lazy"
          />
          <h2 className="text-2xl font-bold text-[color:var(--accent,#2563eb)]">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
            Enter the email address associated with your account and we&apos;ll
            send you a reset link.
          </p>

          {message && (
            <div
              role="status"
              className="mt-6 w-full rounded-lg border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            >
              {message}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 w-full rounded-lg border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleForgotPassword}
            className="mt-6 w-full space-y-6"
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--primary,#2563eb)] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/40 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary,#2563eb)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-8 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
