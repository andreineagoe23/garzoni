import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassContainer } from "components/ui";

function UserProgressBox({ progressData, initiallyExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
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
          username: profileData.username || "User",
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
  }, [loadProfile]);

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
      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        Loading progress...
      </div>
    );
  }

  const overallProgress = progressData?.overall_progress || 0;
  const paths = progressData?.paths || [];

  return (
    <GlassContainer className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative shrink-0 space-y-4 px-5 py-4">
        <div className="flex items-center justify-between">
          <h5 className="flex items-center gap-2 text-lg font-semibold text-[color:var(--text-color,#111827)]">
            <span>User Profile</span>
          </h5>
          <GlassButton variant="danger" size="sm" onClick={handleLogout}>
            Logout
          </GlassButton>
        </div>

        {loading ? (
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Loading user info...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-gradient-to-br from-[color:var(--input-bg,#f3f4f6)] to-[color:var(--input-bg,#f3f4f6)]/80 px-3 py-4 backdrop-blur-sm transition-all hover:border-[color:var(--primary,#1d5330)]/40 hover:shadow-lg hover:shadow-[color:var(--primary,#1d5330)]/20">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <span className="block text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  {userProfile?.points}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Points
                </span>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-gradient-to-br from-[color:var(--input-bg,#f3f4f6)] to-[color:var(--input-bg,#f3f4f6)]/80 px-3 py-4 backdrop-blur-sm transition-all hover:border-[color:var(--primary,#1d5330)]/40 hover:shadow-lg hover:shadow-[color:var(--primary,#1d5330)]/20">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <span className="block text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  {userProfile?.streak}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Day{userProfile?.streak !== 1 ? "s" : ""} Streak
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="relative shrink-0 flex w-full items-center justify-between border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 px-5 py-4 text-left backdrop-blur-sm transition-all hover:bg-[color:var(--card-bg,#ffffff)]/60"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-[color:var(--text-color,#111827)]">
          <span>Learning Progress</span>
        </h3>
        <span className="text-lg text-[color:var(--muted-text,#6b7280)] transition-transform">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>

      {isExpanded && (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/40 px-5 py-5 backdrop-blur-sm scrollbar-neutral"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-[color:var(--muted-text,#6b7280)]">
                  <span>Overall Completion</span>
                </span>
                <span className="font-bold text-[color:var(--accent,#111827)]">
                  {overallProgress.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition-[width] duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {paths.length > 0 && (
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--accent,#111827)]">
                  <span>Path Progress</span>
                </h4>
                <div className="space-y-4">
                  {paths.map((path) => (
                    <div
                      key={path.course}
                      className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-3 backdrop-blur-sm transition-all hover:border-[color:var(--primary,#1d5330)]/40 hover:shadow-md"
                      style={{
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-medium text-[color:var(--muted-text,#6b7280)]">
                          {path.path}
                        </span>
                        <span className="font-bold text-[color:var(--text-color,#111827)]">
                          {path.percent_complete.toFixed(1)}%
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 shadow-md shadow-[color:var(--primary,#1d5330)]/20 transition-[width] duration-500"
                          style={{ width: `${path.percent_complete}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                        {path.course}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassContainer>
  );
}

export default UserProgressBox;
