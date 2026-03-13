import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AvatarSelector from "./AvatarSelector";
import Chatbot from "components/widgets/Chatbot";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import EntitlementUsage from "components/dashboard/EntitlementUsage";
import apiClient from "services/httpClient";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeDateTime,
  getLocale,
} from "utils/format";
import { useTranslation } from "react-i18next";
function Profile() {
  const { t } = useTranslation();
  const locale = getLocale();
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0,
    points: 0,
    streak: 0,
  });
  const [imageUrl, setImageUrl] = useState(DEFAULT_AVATAR_URL);
  const [recentActivity, setRecentActivity] = useState([]);
  const [badges, setBadges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState({
    daily: {
      label: t("profile.goals.dailyLabel"),
      current: 0,
      target: 1,
      completed: false,
    },
    weekly: {
      label: t("profile.goals.weeklyLabel"),
      current: 0,
      target: 500,
      completed: false,
    },
  });
  const [activityCalendar, setActivityCalendar] = useState<
    Record<string, unknown>
  >({});
  const [currentMonth, setCurrentMonth] = useState<{
    first_day?: string | number | Date | null;
    last_day?: string | number | Date | null;
    month_name?: string;
    year?: number | string | null;
  }>({
    first_day: null,
    last_day: null,
    month_name: "",
    year: null,
  });
  const [badgeFilter, setBadgeFilter] = useState("all"); // all | earned | locked
  const weekdayLabels = useMemo(
    () => [
      t("profile.weekdays.sun"),
      t("profile.weekdays.mon"),
      t("profile.weekdays.tue"),
      t("profile.weekdays.wed"),
      t("profile.weekdays.thu"),
      t("profile.weekdays.fri"),
      t("profile.weekdays.sat"),
    ],
    [t]
  );
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [isLgUp, setIsLgUp] = useState(false);

  const {
    getAccessToken,
    loadProfile,
    isAuthenticated,
    isInitialized,
    entitlements,
  } = useAuth();
  const navigate = useNavigate();
  const hasFetchedRef = useRef(false);

  const handleAvatarChange = (newAvatarUrl) => {
    setImageUrl(newAvatarUrl);
  };

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || hasFetchedRef.current) {
      return undefined;
    }

    let isMounted = true;
    const fetchProfileData = async () => {
      setIsLoading(true);
      try {
        const profilePayload = await loadProfile();
        if (!isMounted || !profilePayload) {
          return;
        }
        hasFetchedRef.current = true;

        const profileUserData = profilePayload.user_data || {};
        const resolvedUsername =
          profileUserData.username ||
          profilePayload.username ||
          profilePayload.user?.username ||
          "";
        const resolvedEmail =
          profileUserData.email ||
          profilePayload.email ||
          profilePayload.user?.email ||
          "";

        setProfileData({
          username: String(resolvedUsername || ""),
          email: String(resolvedEmail || ""),
          first_name: String(profileUserData.first_name || ""),
          last_name: String(profileUserData.last_name || ""),
          earned_money:
            parseFloat(String(profileUserData.earned_money || 0)) || 0,
          points:
            typeof profileUserData.points === "number"
              ? profileUserData.points
              : 0,
          streak:
            typeof profilePayload.streak === "number"
              ? profilePayload.streak
              : typeof profileUserData.streak === "number"
                ? profileUserData.streak
                : 0,
        });

        setImageUrl(
          String(profileUserData.profile_avatar || DEFAULT_AVATAR_URL)
        );
        setActivityCalendar(profilePayload.activity_calendar || {});
        setCurrentMonth(profilePayload.current_month || {});

        const missionsResponse = await apiClient.get("/missions/");

        const dailyLessonMission = missionsResponse.data.daily_missions.find(
          (mission) => mission.goal_type === "complete_lesson"
        );

        setGoals((prevGoals) => ({
          daily: {
            ...prevGoals.daily,
            current: dailyLessonMission
              ? Math.round(dailyLessonMission.progress)
              : 0,
            completed: dailyLessonMission
              ? dailyLessonMission.status === "completed"
              : false,
          },
          weekly: {
            ...prevGoals.weekly,
            current:
              typeof profileUserData.points === "number"
                ? profileUserData.points
                : 0,
            completed:
              (typeof profileUserData.points === "number"
                ? profileUserData.points
                : 0) >= prevGoals.weekly.target,
          },
        }));

        const activityResponse = await apiClient.get("/recent-activity/");

        const formattedActivities = activityResponse.data.recent_activities.map(
          (activity) => ({
            id: `${activity.type}-${activity.timestamp}`,
            type: activity.type,
            title: activity.title || activity.name,
            action: activity.action,
            timestamp: formatRelativeDateTime(activity.timestamp, locale),
            details: activity.course ? `in ${activity.course}` : "",
          })
        );

        if (isMounted) {
          setRecentActivity(formattedActivities);
        }

        const [userBadgesResponse, allBadgesResponse] = await Promise.all([
          apiClient.get("/user-badges/"),
          apiClient.get("/badges/"),
        ]);

        const earnedBadgesMap = {};
        userBadgesResponse.data.forEach((userBadge) => {
          earnedBadgesMap[userBadge.badge.id] = userBadge;
        });

        const allBadgesWithStatus = allBadgesResponse.data.map((badge) => {
          const userBadge = earnedBadgesMap[badge.id];
          return {
            badge,
            earned: !!userBadge,
            earned_at: userBadge ? userBadge.earned_at : null,
          };
        });

        if (isMounted) {
          setBadges(allBadgesWithStatus);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProfileData();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadProfile, isAuthenticated, isInitialized, locale]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)"); // tailwind lg
    const update = () => setIsLgUp(Boolean(mq.matches));
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const renderCalendar = () => {
    if (!currentMonth.first_day || !currentMonth.last_day) return null;

    const firstDay = new Date(currentMonth.first_day as string | number | Date);
    const lastDay = new Date(currentMonth.last_day as string | number | Date);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <GlassCard
        padding="md"
        className="space-y-4 bg-[color:var(--card-bg,#ffffff)]/60"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[color:var(--accent,#111827)]">
            {currentMonth.month_name} {currentMonth.year}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {weekdayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-sm">
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="h-16 rounded-xl border border-dashed border-[color:var(--border-color,#d1d5db)]"
              aria-hidden="true"
            />
          ))}
          {days.map((day) => {
            const date = new Date(
              Number(currentMonth.year || 0),
              new Date(
                currentMonth.first_day as string | number | Date
              ).getMonth(),
              day
            );
            const dateStr = date.toISOString().split("T")[0];
            const activityCount = (activityCalendar[dateStr] as number) || 0;
            const hasActivity = activityCount > 0;

            return (
              <div
                key={day}
                className="relative flex h-16 flex-col items-center justify-center rounded-xl border border-[color:var(--border-color,#d1d5db)] text-[color:var(--text-color,#111827)] transition"
                style={{
                  backgroundColor: hasActivity
                    ? "rgba(var(--accent-rgb,59,130,246),0.12)"
                    : "var(--input-bg,rgba(15,23,42,0.04))",
                  boxShadow: hasActivity
                    ? "0 0 0 1px rgba(var(--accent-rgb,59,130,246),0.25)"
                    : "none",
                }}
              >
                <span className="text-sm font-semibold">{day}</span>
                {hasActivity && (
                  <span className="mt-1 rounded-full bg-[color:var(--primary,#2563eb)]/15 px-2 text-xs font-semibold text-[color:var(--accent,#2563eb)]">
                    {activityCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    );
  };

  const displayUsername =
    profileData.username ||
    (profileData.email ? profileData.email.split("@")[0] : "") ||
    t("profile.fallbackUser");

  const visibleBadgeLimit = isLgUp ? 9 : 4; // 3x3 on lg+, 2x2 on smaller
  const filteredBadges = useMemo(() => {
    if (badgeFilter === "earned") return badges.filter((b) => b.earned);
    if (badgeFilter === "locked") return badges.filter((b) => !b.earned);
    return badges;
  }, [badges, badgeFilter]);

  const badgesToRender = showAllBadges
    ? filteredBadges
    : filteredBadges.slice(0, visibleBadgeLimit);

  const entitlementUsage = useMemo(() => {
    const features = entitlements?.features || {};
    return Object.values(features)
      .map(
        (feature: {
          flag?: string;
          name?: string;
          enabled?: boolean;
          used_today?: number;
          remaining_today?: number;
        }) => ({
          key: feature.flag || feature.name,
          name: feature.name,
          enabled: feature.enabled,
          used: feature.used_today,
          remaining: feature.remaining_today,
        })
      )
      .filter((feature) => feature.name && feature.enabled !== false);
  }, [entitlements?.features]);

  if (isLoading) {
    return (
      <PageContainer maxWidth="5xl" layout="centered">
        <div className="flex flex-col items-center gap-4 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          <p className="text-sm">{t("profile.loading")}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="5xl" innerClassName="space-y-10">
      <GlassCard padding="xl" className="space-y-12">
        <section className="flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <img
              src={imageUrl || DEFAULT_AVATAR_URL}
              alt={t("profile.avatarAlt")}
              className="h-36 w-36 rounded-full border-4 border-[color:var(--accent,#2563eb)] object-cover shadow-xl shadow-[color:var(--accent,#2563eb)]/20"
            />
            <div className="absolute -bottom-2 right-2">
              <AvatarSelector
                currentAvatar={imageUrl}
                onAvatarChange={handleAvatarChange}
              />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[color:var(--accent,#111827)]">
              {displayUsername}
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {profileData.first_name} {profileData.last_name}
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {profileData.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/personalized-path")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--accent,#1d4ed8)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#2563eb)]/40"
            >
              <span aria-hidden>🧭</span>
              {t("profile.actions.personalizedPath")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/subscriptions")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              <span aria-hidden>💳</span>
              {t("profile.actions.subscription")}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {t("profile.goals.title")}
            </h3>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("profile.goals.subtitle")}
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {["daily", "weekly"].map((key) => {
              const goal = goals[key];
              const percent =
                (goal.current / goal.target) * 100 > 100
                  ? 100
                  : (goal.current / goal.target) * 100;
              return (
                <GlassCard
                  key={key}
                  padding="md"
                  className={`bg-[color:var(--card-bg,#ffffff)]/60 transition ${
                    goal.completed
                      ? "ring-2 ring-[color:var(--accent,#2563eb)]/40"
                      : ""
                  }`}
                >
                  <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {key === "daily"
                      ? t("profile.goals.dailyTitle")
                      : t("profile.goals.weeklyTitle")}
                  </h4>
                  <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                    {goal.label}
                  </p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                    <div
                      className={`h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width]`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                    {Math.min(goal.current, goal.target)} / {goal.target}
                    {goal.completed && (
                      <span className="ml-2 text-[color:var(--accent,#2563eb)]">
                        {t("profile.goals.completed")}
                      </span>
                    )}
                  </p>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <EntitlementUsage entitlementUsage={entitlementUsage} />
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {t("profile.streak.title")}
            </h3>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("profile.streak.subtitle")}
            </p>
          </header>
          {renderCalendar()}
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {t("profile.stats.title")}
            </h3>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg,#f8fafc)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                {t("profile.stats.balance")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--accent,#111827)]">
                {formatNumber(Number(profileData.earned_money || 0), locale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                {t("rewards.coins")}
              </p>
            </GlassCard>
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg,#f8fafc)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                {t("profile.stats.points")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--accent,#111827)]">
                {profileData.points}
              </p>
            </GlassCard>
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg,#f8fafc)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                {t("profile.stats.streak")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--accent,#111827)]">
                {t("profile.stats.streakDays", {
                  count: profileData.streak,
                })}
              </p>
              <div className="mt-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                {profileData.streak >= 7 ? (
                  <span className="text-emerald-500">
                    {t("profile.stats.hotStreak")}
                  </span>
                ) : profileData.streak >= 3 ? (
                  <span className="text-amber-400">
                    {t("profile.stats.keepGoing")}
                  </span>
                ) : (
                  <span>{t("profile.stats.startStreak")}</span>
                )}
              </div>
            </GlassCard>
          </div>
        </section>

        <section className="space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                {t("profile.achievements.title")}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("profile.achievements.showing", {
                  shown: Math.min(badgesToRender.length, filteredBadges.length),
                  total: filteredBadges.length,
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="badge-filter"
                className="text-sm font-medium text-[color:var(--text-color,#111827)]"
              >
                {t("profile.achievements.filterLabel")}
              </label>
              <select
                id="badge-filter"
                value={badgeFilter}
                onChange={(e) => {
                  setBadgeFilter(e.target.value);
                  setShowAllBadges(false);
                }}
                className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              >
                <option value="all">
                  {t("profile.achievements.filterAll")}
                </option>
                <option value="earned">
                  {t("profile.achievements.filterEarned")}
                </option>
                <option value="locked">
                  {t("profile.achievements.filterLocked")}
                </option>
              </select>

              {filteredBadges.length > visibleBadgeLimit && (
                <button
                  type="button"
                  onClick={() => setShowAllBadges((prev) => !prev)}
                  className="rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                >
                  {showAllBadges
                    ? t("profile.achievements.showLess")
                    : t("profile.achievements.showAll")}
                </button>
              )}
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badgesToRender.length > 0 ? (
              badgesToRender.map((userBadge) => (
                <GlassCard
                  key={userBadge.badge.id}
                  padding="md"
                  className="flex h-28 flex-col items-center justify-center bg-[color:var(--input-bg,#f3f4f6)]/60 text-center transition"
                  title={`${userBadge.badge.name}\n${
                    userBadge.badge.description ||
                    t("profile.achievements.earnedAchievement")
                  }`}
                  style={
                    userBadge.earned
                      ? {}
                      : { opacity: 0.5, filter: "grayscale(40%)" }
                  }
                >
                  <img
                    src={userBadge.badge.image_url}
                    alt={userBadge.badge.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                  <p className="mt-3 text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {userBadge.earned
                      ? userBadge.badge.name
                      : t("profile.achievements.locked")}
                  </p>
                  {userBadge.earned && userBadge.earned_at && (
                    <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                      {t("profile.achievements.earnedOn", {
                        date: formatDate(userBadge.earned_at),
                      })}
                    </p>
                  )}
                </GlassCard>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("profile.achievements.empty")}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {t("profile.activity.title")}
            </h3>
          </header>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.slice(0, 3).map((activity) => (
                <GlassCard
                  key={activity.id}
                  padding="sm"
                  className="flex flex-wrap items-center justify-between gap-2 bg-[color:var(--card-bg,#ffffff)]/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[color:var(--accent,#111827)]">
                      {activity.title}
                    </p>
                    {activity.details ? (
                      <p className="truncate text-xs text-[color:var(--muted-text,#6b7280)]">
                        {activity.details}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-[color:var(--muted-text,#6b7280)]">
                    {activity.timestamp}
                  </span>
                </GlassCard>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("profile.activity.empty")}
            </p>
          )}

          {recentActivity.length > 3 && (
            <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
              {t("profile.activity.showing", {
                total: recentActivity.length,
              })}
            </p>
          )}
        </section>
      </GlassCard>
      <Chatbot />
    </PageContainer>
  );
}

export default Profile;
