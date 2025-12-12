import React, { useEffect, useState } from "react";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import registerBg from "assets/register-bg.jpg";
import Header from "components/layout/Header";
import { useAuth } from "contexts/AuthContext";
import { GlassCard, GlassButton } from "components/ui";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    referral_code: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { registerUser } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await registerUser(formData);
      if (result.success) {
        navigate("/all-topics");
      } else {
        setErrorMessage(
          result.error || "Registration failed. Please try again."
        );
      }
    } catch (registerError) {
      setErrorMessage(
        registerError.response?.data?.error ||
          registerError.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <>
      <Header />
      <div
        className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${registerBg})` }}
      >
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-[110px] sm:px-8 lg:px-10">
          <GlassCard padding="lg" className="w-full max-w-md">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                Create Your Account
              </h2>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                Join us and start your financial journey
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]"
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-8 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="first_name"
                    className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                  >
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                    placeholder="Enter your first name"
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="last_name"
                    className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                  >
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                    placeholder="Enter your last name"
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                </div>
              </div>

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
                  placeholder="Choose a username"
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
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
                    autoComplete="new-password"
                    placeholder="Create a password"
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 pr-12 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--primary,#1d5330)]"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="referral_code"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  Referral Code{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="referral_code"
                  name="referral_code"
                  type="text"
                  value={formData.referral_code}
                  onChange={handleChange}
                  placeholder="Enter referral code if you have one"
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                />
              </div>

              <div className="space-y-3">
                <GlassButton
                  type="submit"
                  disabled={isLoading}
                  variant="primary"
                  className="w-full"
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </GlassButton>
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
              >
                Login here
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

export default Register;
