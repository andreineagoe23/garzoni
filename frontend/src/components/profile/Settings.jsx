import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

function Settings() {
  const { getAccessToken, logoutUser, loadSettings } = useAuth();
  const navigate = useNavigate();

  const [emailReminderPreference, setEmailReminderPreference] =
    useState("none");
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await loadSettings();
        if (!isMounted || !data) return;

        const profile = data.profile || {};
        setEmailReminderPreference(
          data.email_reminder_preference || "none"
        );
        setProfileData({
          username: profile.username || "",
          email: profile.email || "",
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
        });
      } catch (error) {
        console.error("Error fetching settings:", error);
        setErrorMessage("Failed to load settings. Please try again.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    try {
      setErrorMessage("");
      await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
        {
          profile: {
            username: profileData.username,
            email: profileData.email,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
          },
          email_reminder_preference: emailReminderPreference,
        },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      setSuccessMessage("Settings updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);

      await loadSettings({ force: true });
    } catch (error) {
      console.error("Error updating settings:", error);
      setErrorMessage("Failed to save settings. Please try again.");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async () => {
    setSuccessMessage("");
    setErrorMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/change-password/`,
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );

      setSuccessMessage("Password updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Failed to update password.";
      setErrorMessage(message);
    }
  };

  const handleDeleteAccount = async () => {
    setErrorMessage("");
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    if (!deletePassword) {
      setErrorMessage("Please enter your password to confirm deletion.");
      return;
    }

    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/delete-account/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          withCredentials: true,
          data: { password: deletePassword },
        }
      );

      logoutUser();
      navigate("/");
    } catch (error) {
      if (error.response?.status === 400) {
        setErrorMessage("Incorrect password. Please try again.");
      } else {
        setErrorMessage("Failed to delete account. Please try again.");
      }
      setIsConfirmingDelete(false);
      setDeletePassword("");
    }
  };

  return (
    <PageContainer maxWidth="4xl" innerClassName="space-y-8">
      {successMessage && (
        <GlassCard padding="md" className="border-emerald-500/40 bg-emerald-500/10 text-sm text-emerald-400 shadow-emerald-500/10">
          {successMessage}
        </GlassCard>
      )}

      {errorMessage && (
        <GlassCard padding="md" className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10">
          {errorMessage}
        </GlassCard>
      )}

      <GlassCard padding="xl" className="transition-colors">
        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-12">
            <section className="space-y-6">
                <header>
                  <h4 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    Profile Information
                  </h4>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    Update your personal details and email address.
                  </p>
                </header>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={profileData.first_name}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={profileData.last_name}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={profileData.username}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <header>
                  <h4 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    Preferences
                  </h4>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    Control reminders and personalization options.
                  </p>
                </header>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Email Reminders
                    </label>
                    <select
                      value={emailReminderPreference}
                      onChange={(event) => setEmailReminderPreference(event.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    >
                      <option value="none">No Reminders</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <header>
                  <h4 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    Change Password
                  </h4>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    Create a strong password to keep your account secure.
                  </p>
                </header>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleChangePassword}
                  className="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-text,#374151)] shadow-sm transition hover:border-[color:var(--accent,#2563eb)] hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Update Password
                </button>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-text,#6b7280)]">
                  <button
                    type="button"
                    className="font-semibold text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
                    onClick={() => window.UC_UI?.showSecondLayer?.()}
                  >
                    Privacy Settings
                  </button>
                  <span>•</span>
                  <Link
                    to="/cookie-policy"
                    className="font-semibold text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
                  >
                    Cookie Policy
                  </Link>
                </div>
              </section>

              <section className="space-y-6">
                <header>
                  <h4 className="text-lg font-semibold text-[color:var(--error,#dc2626)]">
                    Danger Zone
                  </h4>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    Permanently remove your account and all associated data.
                  </p>
                </header>

                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="inline-flex items-center justify-center rounded-lg border border-[color:var(--error,#dc2626)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--error,#dc2626)] shadow-sm transition hover:bg-[color:var(--error,#dc2626)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/30"
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="space-y-4 rounded-xl border border-[color:var(--error,#dc2626)]/30 bg-[color:var(--error,#dc2626)]/5 p-4 shadow-inner shadow-[color:var(--error,#dc2626)]/10">
                    <p className="text-sm text-[color:var(--error,#dc2626)]">
                      This action cannot be undone. Please enter your password to confirm.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2.5 text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--error,#dc2626)] focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/30"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-[color:var(--error,#dc2626)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[color:var(--error,#dc2626)]/30 transition hover:shadow-lg hover:shadow-[color:var(--error,#dc2626)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                      >
                        Confirm Deletion
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsConfirmingDelete(false);
                          setDeletePassword("");
                          setErrorMessage("");
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-text,#374151)] transition hover:border-[color:var(--accent,#2563eb)] hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <div className="flex justify-end border-t border-[color:var(--border-color,#d1d5db)] pt-6">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="inline-flex items-center justify-center rounded-lg bg-[color:var(--primary,#2563eb)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-lg hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
      </GlassCard>
    </PageContainer>
  );
}

export default Settings;

