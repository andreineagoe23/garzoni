import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import loginBg from "assets/login-bg.jpg";
import Header from "components/layout/Header";
import { useAuth } from "contexts/AuthContext";
import { GlassCard, GlassButton } from "components/ui";

function Login() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    remember_me: false,
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser, isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Avoid redirect loops into gated flows that immediately bounce to questionnaires/upgrade
      const from = location.state?.from?.pathname;
      const gatedPaths = ["/personalized-path", "/upgrade", "/payment-required"];
      const destination = gatedPaths.includes(from) ? "/all-topics" : from;

      // Default to the main dashboard when there's no safe destination
      const targetPath = destination || "/all-topics";
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleChange = (event) => {
    const { name, type, checked, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!isInitialized) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await loginUser(formData);
      if (!result.success) {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (loginError) {
      setError(
        loginError.response?.data?.detail ||
          loginError.response?.data?.error ||
          "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div
        className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-[110px] sm:px-8 lg:px-10">
          <GlassCard padding="lg" className="w-full max-w-md">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                Welcome Back!
              </h2>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                Please enter your credentials to continue
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  placeholder="Enter your username"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 pr-12 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--primary,#1d5330)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-[color:var(--muted-text,#4b5563)]">
                  <input
                    type="checkbox"
                    name="remember_me"
                    checked={formData.remember_me}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="space-y-3">
                <GlassButton
                  type="submit"
                  disabled={isLoading}
                  variant="primary"
                  className="w-full"
                >
                  {isLoading ? "Logging in..." : "Login"}
                </GlassButton>
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
              <span>Don&apos;t have an account? </span>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
              >
                Sign up now
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

export default Login;

