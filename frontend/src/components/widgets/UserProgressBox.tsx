import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassContainer } from "components/ui";
import { formatNumber, getLocale } from "utils/format";

function UserProgressBox({ progressData }) {
  const { t } = useTranslation();
  const locale = getLocale();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { logoutUser, loadProfile } = useAuth();

  useEffect(() => {
    let isMounted = true;
    const fetchUserProfile = async () => {
      try {
        const profilePayload = await loadProfile();
        if (!isMounted) return;
        const profileData = profilePayload?.user_data ?? profilePayload ?? {};
        setUserProfile({
          points: profileData.points || 0,
          streak: profilePayload?.streak || 0,
          username: profileData.username || t("profile.fallbackUser"),
        });
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserProfile();

    return () => {
      isMounted = false;
    };
  }, [loadProfile, t]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
      navigate("/login");
    }
  };

  if (!progressData) {
    return (
      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-content-muted shadow-inner shadow-black/5">
        {t("widgets.userProgress.loading")}
      </div>
    );
  }

  const overallProgress = progressData?.overall_progress || 0;
  const paths = progressData?.paths || [];

  return (
    <GlassContainer
      className="relative flex w-full flex-col overflow-hidden"
      style={{ height: "100%", maxHeight: "100%", minHeight: 0 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent,#ffd700)]/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative shrink-0 space-y-4 px-5 py-4">
        <div className="flex items-center justify-between">
          <h5 className="flex items-center gap-2 text-lg font-semibold text-content-primary">
            <span>{t("widgets.userProgress.userProfile")}</span>
          </h5>
          <GlassButton variant="danger" size="sm" onClick={handleLogout}>
            {t("widgets.userProgress.logout")}
          </GlassButton>
        </div>

        {loading ? (
          <p className="text-sm text-content-muted">
            {t("widgets.userProgress.loadingUserInfo")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-gradient-to-br from-[color:var(--input-bg,#f3f4f6)] to-[color:var(--input-bg,#f3f4f6)]/80 px-3 py-4 backdrop-blur-sm transition-all hover:border-[color:var(--accent,#ffd700)]/40 hover:shadow-lg hover:shadow-[color:var(--accent,#ffd700)]/20">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent,#ffd700)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <span className="block text-2xl font-bold text-content-primary">
                  {userProfile?.points}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-wide text-content-muted">
                  {t("widgets.userProgress.points")}
                </span>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-gradient-to-br from-[color:var(--input-bg,#f3f4f6)] to-[color:var(--input-bg,#f3f4f6)]/80 px-3 py-4 backdrop-blur-sm transition-all hover:border-[color:var(--accent,#ffd700)]/40 hover:shadow-lg hover:shadow-[color:var(--accent,#ffd700)]/20">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent,#ffd700)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <span className="block text-2xl font-bold text-content-primary">
                  {userProfile?.streak}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-wide text-content-muted">
                  {t("widgets.userProgress.streak", {
                    count: userProfile?.streak || 0,
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="relative shrink-0 border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 px-5 py-4 backdrop-blur-sm"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-content-primary">
          <span>{t("widgets.userProgress.learningProgress")}</span>
        </h3>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 px-5 py-5 backdrop-blur-sm scrollbar-neutral"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          maxHeight: "100%",
        }}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-content-muted">
                <span>{t("widgets.userProgress.overallCompletion")}</span>
              </span>
              <span className="font-bold text-content-primary">
                {formatNumber(overallProgress, locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 shadow-lg shadow-[color:var(--accent,#ffd700)]/30 transition-[width] duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {paths.length > 0 && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-content-primary">
                <span>{t("widgets.userProgress.pathProgress")}</span>
              </h4>
              <div className="space-y-4">
                {paths.map((path) => (
                  <div
                    key={path.course}
                    className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-3 backdrop-blur-sm transition-all hover:border-[color:var(--accent,#ffd700)]/40 hover:shadow-md"
                    style={{
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-medium text-content-muted">
                        {path.path}
                      </span>
                      <span className="font-bold text-content-primary">
                        {formatNumber(path.percent_complete, locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 shadow-md shadow-[color:var(--accent,#ffd700)]/20 transition-[width] duration-500"
                        style={{ width: `${path.percent_complete}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-content-muted">
                      {path.course}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassContainer>
  );
}

export default UserProgressBox;
