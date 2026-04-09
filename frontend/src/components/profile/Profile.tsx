import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AvatarSelector from "./AvatarSelector";
import Chatbot from "components/widgets/Chatbot";
import PageContainer from "components/common/PageContainer";
import StatBadge from "components/common/StatBadge";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import EntitlementUsage from "components/dashboard/EntitlementUsage";
import apiClient from "services/httpClient";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import ActivityCalendar from "./ActivityCalendar";
import {
  formatDate,
  formatNumber,
  formatRelativeDateTime,
  getLocale,
} from "utils/format";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, staleTimes } from "lib/reactQuery";
function Profile() {
  type RecentActivityItem = {
    id: string;
    type: string;
    title: string;
    action: string;
    timestamp: string;
    details: string;
  };
  type BadgeItem = {
    badge: {
      id: number;
      name: string;
      description?: string;
      image_url: string;
    };
    earned: boolean;
    earned_at: string | null;
  };
  type RecentActivityApiItem = {
    type: string;
    title?: string;
    name?: string;
    action: string;
    timestamp: string;
    course?: string;
  };
  type UserBadgeApiItem = { earned_at: string; badge: { id: number } };
  type BadgeApiItem = {
    id: number;
    name: string;
    description?: string;
    image_url: string;
  };
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
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    []
  );
  const [badges, setBadges] = useState<BadgeItem[]>([]);
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
  const [showAllActivity, setShowAllActivity] = useState(false);

  const {
    loadProfile,
    isAuthenticated,
    isInitialized,
    entitlements,
    profile: authProfile,
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profilePayload } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => loadProfile(),
    staleTime: staleTimes.profile,
    enabled: isInitialized && isAuthenticated,
    initialData: authProfile ?? undefined,
    placeholderData: (previousData) => previousData ?? authProfile ?? undefined,
  });

  const handleAvatarChange = (newAvatarUrl) => {
    setImageUrl(newAvatarUrl);
  };

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    const fetchProfileData = async () => {
      setIsLoading(true);
      try {
        const resolvedProfilePayload = profilePayload || authProfile;
        const [missionsResponse, activityResponse] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: queryKeys.missions(),
            queryFn: () => apiClient.get("/missions/"),
            staleTime: 30_000,
          }),
          apiClient.get("/recent-activity/"),
        ]);
        if (!isMounted || !resolvedProfilePayload) {
          return;
        }

        const profileUserData = resolvedProfilePayload.user_data || {};
        const resolvedUsername =
          resolvedProfilePayload.username || profileUserData.username || "";
        const resolvedEmail =
          resolvedProfilePayload.email || profileUserData.email || "";
        const resolvedFirstName =
          resolvedProfilePayload.first_name || profileUserData.first_name || "";
        const resolvedLastName =
          resolvedProfilePayload.last_name || profileUserData.last_name || "";

        setProfileData({
          username: String(resolvedUsername || ""),
          email: String(resolvedEmail || ""),
          first_name: String(resolvedFirstName || ""),
          last_name: String(resolvedLastName || ""),
          earned_money:
            parseFloat(String(profileUserData.earned_money || 0)) || 0,
          points:
            typeof profileUserData.points === "number"
              ? profileUserData.points
              : 0,
          streak:
            typeof resolvedProfilePayload.streak === "number"
              ? resolvedProfilePayload.streak
              : typeof profileUserData.streak === "number"
                ? profileUserData.streak
                : 0,
        });

        setImageUrl(
          String(profileUserData.profile_avatar || DEFAULT_AVATAR_URL)
        );
        setActivityCalendar(resolvedProfilePayload.activity_calendar || {});
        setCurrentMonth(resolvedProfilePayload.current_month || {});

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

        const formattedActivities: RecentActivityItem[] =
          activityResponse.data.recent_activities.map(
            (activity: RecentActivityApiItem) => ({
              id: `${activity.type}-${activity.timestamp}`,
              type: activity.type,
              title: String(activity.title || activity.name || ""),
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

        const earnedBadgesMap: Record<number, UserBadgeApiItem> = {};
        userBadgesResponse.data.forEach((userBadge: UserBadgeApiItem) => {
          earnedBadgesMap[userBadge.badge.id] = userBadge;
        });

        const allBadgesWithStatus: BadgeItem[] = allBadgesResponse.data.map(
          (badge: BadgeApiItem) => {
            const userBadge = earnedBadgesMap[badge.id];
            return {
              badge,
              earned: !!userBadge,
              earned_at: userBadge ? userBadge.earned_at : null,
            };
          }
        );

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
  }, [
    authProfile,
    isAuthenticated,
    isInitialized,
    locale,
    profilePayload,
    queryClient,
  ]);

  const displayUsername =
    profileData.username ||
    (profileData.email ? profileData.email.split("@")[0] : "") ||
    t("profile.fallbackUser");

  const visibleBadgeLimit = 6;
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
        <div className="flex flex-col items-center gap-4 text-content-muted">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
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
              className="h-36 w-36 rounded-full border-4 border-[color:var(--accent)] object-cover shadow-xl shadow-[color:var(--accent)]/20"
            />
            <div className="absolute -bottom-2 right-2">
              <AvatarSelector
                currentAvatar={imageUrl}
                onAvatarChange={handleAvatarChange}
              />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-content-primary">
              {displayUsername}
            </h2>
            <p className="text-sm text-content-muted">
              {profileData.first_name} {profileData.last_name}
            </p>
            <p className="text-sm text-content-muted">{profileData.email}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/personalized-path")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent)]/30 transition hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            >
              <span aria-hidden>🧭</span>
              {t("profile.actions.personalizedPath")}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  ["active", "trialing"].includes(entitlements?.status ?? "")
                    ? "/billing"
                    : "/subscriptions"
                )
              }
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary)]/90 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent)]/30 transition hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            >
              <span aria-hidden>💳</span>
              {["active", "trialing"].includes(entitlements?.status ?? "")
                ? t("billing.manageSubscription")
                : t("profile.actions.subscription")}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-content-primary">
              {t("profile.goals.title")}
            </h3>
            <p className="text-sm text-content-muted">
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
                  className={`bg-[color:var(--card-bg)]/60 transition ${
                    goal.completed ? "ring-2 ring-[color:var(--accent)]/40" : ""
                  }`}
                >
                  <h4 className="text-sm font-semibold text-content-primary">
                    {key === "daily"
                      ? t("profile.goals.dailyTitle")
                      : t("profile.goals.weeklyTitle")}
                  </h4>
                  <p className="mt-1 text-sm text-content-muted">
                    {goal.label}
                  </p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg)]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-[color:var(--accent)]/90 to-[color:var(--accent)]/45 transition-[width]`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-medium text-content-muted">
                    {Math.min(goal.current, goal.target)} / {goal.target}
                    {goal.completed && (
                      <span className="ml-2 text-[color:var(--accent)]">
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
            <h3 className="text-lg font-semibold text-content-primary">
              {t("profile.streak.title")}
            </h3>
            <p className="text-sm text-content-muted">
              {t("profile.streak.subtitle")}
            </p>
          </header>
          <ActivityCalendar
            currentMonth={currentMonth}
            activityCalendar={activityCalendar}
            weekdayLabels={weekdayLabels}
          />
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-content-primary">
              {t("profile.stats.title")}
            </h3>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            <StatBadge
              label={t("profile.stats.balance")}
              value={formatNumber(
                Number(profileData.earned_money || 0),
                locale,
                {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }
              )}
              unit={t("rewards.coins")}
              className="text-center bg-[color:var(--input-bg)]/60"
            />
            <StatBadge
              label={t("profile.stats.points")}
              value={formatNumber(Number(profileData.points || 0), locale)}
              unit="XP"
              className="text-center bg-[color:var(--input-bg)]/60"
            />
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-content-muted">
                {t("profile.stats.streak")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-content-primary">
                {t("profile.stats.streakDays", {
                  count: profileData.streak,
                })}
              </p>
              <div className="mt-2 text-xs font-semibold text-content-muted">
                {profileData.streak >= 7 ? (
                  <span className="text-[color:var(--accent)]">
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
              <h3 className="text-lg font-semibold text-content-primary">
                {t("profile.achievements.title")}
              </h3>
              <p className="mt-1 text-sm text-content-muted">
                {t("profile.achievements.showing", {
                  shown: Math.min(badgesToRender.length, filteredBadges.length),
                  total: filteredBadges.length,
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="badge-filter"
                className="text-sm font-medium text-content-primary"
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
                className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
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
                  className="rounded-full border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/70 px-4 py-2 text-xs font-semibold text-content-muted transition hover:border-[color:var(--accent)]/50 hover:text-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
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
                  className="flex h-28 flex-col items-center justify-center bg-[color:var(--input-bg)]/60 text-center transition"
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
                    width={56}
                    height={56}
                    loading="lazy"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).src =
                        DEFAULT_AVATAR_URL;
                    }}
                  />
                  <p className="mt-3 text-sm font-semibold text-content-primary">
                    {userBadge.earned
                      ? userBadge.badge.name
                      : t("profile.achievements.locked")}
                  </p>
                  {userBadge.earned && userBadge.earned_at && (
                    <p className="mt-1 text-xs text-content-muted">
                      {t("profile.achievements.earnedOn", {
                        date: formatDate(userBadge.earned_at),
                      })}
                    </p>
                  )}
                </GlassCard>
              ))
            ) : (
              <p className="text-sm text-content-muted">
                {t("profile.achievements.empty")}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-content-primary">
              {t("profile.activity.title")}
            </h3>
          </header>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {(showAllActivity
                ? recentActivity
                : recentActivity.slice(0, 3)
              ).map((activity) => (
                <GlassCard
                  key={activity.id}
                  padding="sm"
                  className="flex flex-wrap items-center justify-between gap-2 bg-[color:var(--card-bg)]/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content-primary">
                      {activity.title}
                    </p>
                    {activity.details ? (
                      <p className="truncate text-xs text-content-muted">
                        {activity.details}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-content-muted">
                    {activity.timestamp}
                  </span>
                </GlassCard>
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-muted">
              {t("profile.activity.empty")}
            </p>
          )}

          {recentActivity.length > 3 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-xs text-content-muted">
                {t("profile.activity.showing", {
                  total: recentActivity.length,
                })}
              </p>
              <button
                type="button"
                onClick={() => setShowAllActivity((prev) => !prev)}
                className="rounded-full border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/70 px-4 py-2 text-xs font-semibold text-content-muted transition hover:border-[color:var(--accent)]/50 hover:text-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
              >
                {showAllActivity
                  ? t("profile.achievements.showLess")
                  : t("profile.achievements.showAll")}
              </button>
            </div>
          )}
        </section>
      </GlassCard>
      <Chatbot />
    </PageContainer>
  );
}

export default Profile;
