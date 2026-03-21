import React, { useEffect, useState } from "react";
import apiClient from "services/httpClient";
import { Link, useNavigate } from "react-router-dom";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { UserProfile } from "types/api";
import { useTranslation } from "react-i18next";

function Settings() {
  const { getAccessToken, logoutUser, loadSettings } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await loadSettings();
        if (!isMounted || !data) return;

        const profile = (data as { profile?: UserProfile }).profile || {};
        const pref = String(
          (data as { email_reminder_preference?: unknown })
            .email_reminder_preference || "none"
        );
        setEmailReminderPreference(pref === "daily" ? "weekly" : pref);
        setSoundEnabled(
          Boolean((data as { sound_enabled?: boolean }).sound_enabled ?? true)
        );
        setAnimationsEnabled(
          Boolean(
            (data as { animations_enabled?: boolean }).animations_enabled ??
            true
          )
        );
        setProfileData({
          username: String((profile as UserProfile).username || ""),
          email: String((profile as UserProfile).email || ""),
          first_name: String((profile as UserProfile).first_name || ""),
          last_name: String((profile as UserProfile).last_name || ""),
        });
      } catch (error) {
        console.error("Error fetching settings:", error);
        setErrorMessage(t("settings.errors.loadSettings"));
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
  }, [loadSettings, t]);

  const handleSaveSettings = async () => {
    try {
      setErrorMessage("");
      await apiClient.patch("/user/settings/", {
        profile: {
          username: profileData.username,
          email: profileData.email,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
        },
        email_reminder_preference: emailReminderPreference,
        sound_enabled: soundEnabled,
        animations_enabled: animationsEnabled,
      });

      setSuccessMessage(t("settings.success.updated"));
      setTimeout(() => setSuccessMessage(""), 3000);

      await loadSettings({ force: true });
    } catch (error) {
      console.error("Error updating settings:", error);
      setErrorMessage(t("settings.errors.saveSettings"));
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
      setErrorMessage(t("settings.errors.passwordFields"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t("settings.errors.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(t("settings.errors.passwordLength"));
      return;
    }

    try {
      await apiClient.post("/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccessMessage(t("settings.success.passwordUpdated"));
      setTimeout(() => setSuccessMessage(""), 3000);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const e = error as {
        response?: { data?: { error?: string; detail?: string } };
      };
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        t("settings.errors.passwordUpdate");
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
      setErrorMessage(t("settings.errors.deletePassword"));
      return;
    }

    try {
      await apiClient.delete("/delete-account/", {
        data: { password: deletePassword },
      });

      logoutUser();
      navigate("/");
    } catch (error: unknown) {
      if (
        (error as { response?: { status?: number } })?.response?.status === 400
      ) {
        setErrorMessage(t("settings.errors.incorrectPassword"));
      } else {
        setErrorMessage(t("settings.errors.deleteAccount"));
      }
      setIsConfirmingDelete(false);
      setDeletePassword("");
    }
  };

  return (
    <PageContainer maxWidth="4xl" innerClassName="space-y-8">
      {successMessage && (
        <GlassCard
          padding="md"
          className="border-[color:var(--accent,#ffd700)]/35 bg-[color:var(--accent,#ffd700)]/10 text-sm text-[color:var(--accent,#ffd700)] shadow-[color:var(--accent,#ffd700)]/10"
        >
          {successMessage}
        </GlassCard>
      )}

      {errorMessage && (
        <GlassCard
          padding="md"
          className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10"
        >
          {errorMessage}
        </GlassCard>
      )}

      <GlassCard padding="xl" className="transition-colors">
        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent,#ffd700)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-12">
            <section className="space-y-6">
              <header>
                <h4 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                  {t("settings.profile.title")}
                </h4>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("settings.profile.subtitle")}
                </p>
              </header>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.profile.firstName")}
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.profile.lastName")}
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={profileData.last_name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.profile.username")}
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={profileData.username}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.profile.email")}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <header>
                <h4 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                  {t("settings.preferences.title")}
                </h4>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("settings.preferences.subtitle")}
                </p>
              </header>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.preferences.emailReminders")}
                  </label>
                  <select
                    value={emailReminderPreference}
                    onChange={(event) =>
                      setEmailReminderPreference(event.target.value)
                    }
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  >
                    <option value="none">
                      {t("settings.preferences.reminders.none")}
                    </option>
                    <option value="weekly">
                      {t("settings.preferences.reminders.weekly")}
                    </option>
                    <option value="monthly">
                      {t("settings.preferences.reminders.monthly")}
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.preferences.lessonSounds")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(event) =>
                        setSoundEnabled(event.target.checked)
                      }
                      className="h-4 w-4 rounded border border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--accent,#ffd700)]"
                    />
                    <span className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      {t("settings.preferences.soundsHint")}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.preferences.animations")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={animationsEnabled}
                      onChange={(event) =>
                        setAnimationsEnabled(event.target.checked)
                      }
                      className="h-4 w-4 rounded border border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--accent,#ffd700)]"
                    />
                    <span className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      {t("settings.preferences.animationsHint")}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <header>
                <h4 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                  {t("settings.password.title")}
                </h4>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("settings.password.subtitle")}
                </p>
              </header>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.password.current")}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.password.new")}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    {t("settings.password.confirm")}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleChangePassword}
                className="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-text,#374151)] shadow-sm transition hover:border-[color:var(--accent,#ffd700)] hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              >
                {t("settings.password.update")}
              </button>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-text,#6b7280)]">
                <button
                  type="button"
                  className="font-semibold text-[color:var(--accent,#ffd700)] transition hover:text-[color:var(--accent,#ffd700)]/80"
                  onClick={() => window.UC_UI?.showSecondLayer?.()}
                >
                  {t("settings.privacy.settings")}
                </button>
                <span>•</span>
                <Link
                  to="/cookie-policy"
                  className="font-semibold text-[color:var(--accent,#ffd700)] transition hover:text-[color:var(--accent,#ffd700)]/80"
                >
                  {t("settings.privacy.cookiePolicy")}
                </Link>
                <span>•</span>
                <Link
                  to="/privacy-policy"
                  className="font-semibold text-[color:var(--accent,#ffd700)] transition hover:text-[color:var(--accent,#ffd700)]/80"
                >
                  {t("settings.privacy.privacyPolicy")}
                </Link>
                <span>•</span>
                <Link
                  to="/financial-disclaimer"
                  className="font-semibold text-[color:var(--accent,#ffd700)] transition hover:text-[color:var(--accent,#ffd700)]/80"
                >
                  {t("settings.privacy.financialDisclaimer")}
                </Link>
              </div>
            </section>

            <section className="space-y-6">
              <header>
                <h4 className="text-lg font-semibold text-[color:var(--error,#dc2626)]">
                  {t("settings.danger.title")}
                </h4>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("settings.danger.subtitle")}
                </p>
              </header>

              {!isConfirmingDelete ? (
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="inline-flex items-center justify-center rounded-lg border border-[color:var(--error,#dc2626)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--error,#dc2626)] shadow-sm transition hover:bg-[color:var(--error,#dc2626)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/30"
                >
                  {t("settings.danger.deleteAccount")}
                </button>
              ) : (
                <div className="space-y-4 rounded-xl border border-[color:var(--error,#dc2626)]/30 bg-[color:var(--error,#dc2626)]/5 p-4 shadow-inner shadow-[color:var(--error,#dc2626)]/10">
                  <p className="text-sm text-[color:var(--error,#dc2626)]">
                    {t("settings.danger.confirmNote")}
                  </p>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder={t("settings.danger.passwordPlaceholder")}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2.5 text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--error,#dc2626)] focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/30"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-[color:var(--error,#dc2626)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[color:var(--error,#dc2626)]/30 transition hover:shadow-lg hover:shadow-[color:var(--error,#dc2626)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                    >
                      {t("settings.danger.confirmDeletion")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingDelete(false);
                        setDeletePassword("");
                        setErrorMessage("");
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-text,#374151)] transition hover:border-[color:var(--accent,#ffd700)] hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                    >
                      {t("settings.actions.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <div className="flex justify-end border-t border-[color:var(--border-color,#d1d5db)] pt-6">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="inline-flex items-center justify-center rounded-lg bg-[color:var(--primary,#1d5330)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[color:var(--accent,#ffd700)]/30 transition hover:shadow-lg hover:shadow-[color:var(--accent,#ffd700)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
              >
                {t("settings.actions.save")}
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </PageContainer>
  );
}

export default Settings;
