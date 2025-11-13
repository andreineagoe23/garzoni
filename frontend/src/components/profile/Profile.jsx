import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";
import AvatarSelector from "./AvatarSelector";
import Chatbot from "components/widgets/Chatbot";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const activityIcons = {
  lesson: "📘",
  quiz: "🧠",
  mission: "🚀",
  course: "🎓",
  default: "📌",
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0,
    points: 0,
    streak: 0,
  });
  const [imageUrl, setImageUrl] = useState("/default-avatar.png");
  const [recentActivity, setRecentActivity] = useState([]);
  const [badges, setBadges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState({
    daily: {
      label: "Complete 1 lesson",
      current: 0,
      target: 1,
      completed: false,
    },
    weekly: {
      label: "Earn 500 points",
      current: 0,
      target: 500,
      completed: false,
    },
  });
  const [activityCalendar, setActivityCalendar] = useState({});
  const [currentMonth, setCurrentMonth] = useState({
    first_day: null,
    last_day: null,
    month_name: "",
    year: null,
  });

  const { getAccessToken, loadProfile, isAuthenticated, isInitialized } =
    useAuth();
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

        setProfileData({
          username: profileUserData.username || "",
          email: profileUserData.email || "",
          first_name: profileUserData.first_name || "",
          last_name: profileUserData.last_name || "",
          earned_money: parseFloat(profileUserData.earned_money) || 0,
          points: profileUserData.points || 0,
          streak: profilePayload.streak ?? profileUserData.streak ?? 0,
        });

        setImageUrl(profileUserData.profile_avatar || "/default-avatar.png");
        setActivityCalendar(profilePayload.activity_calendar || {});
        setCurrentMonth(profilePayload.current_month || {});

        const token = getAccessToken();
        const authHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const missionsResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/missions/`,
          {
            headers: authHeaders,
          }
        );

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
            current: profileUserData.points,
            completed: (profileUserData.points || 0) >= prevGoals.weekly.target,
          },
        }));

        const activityResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/recent-activity/`,
          {
            headers: authHeaders,
          }
        );

        const formattedActivities = activityResponse.data.recent_activities.map(
          (activity) => ({
            id: `${activity.type}-${activity.timestamp}`,
            type: activity.type,
            title: activity.title || activity.name,
            action: activity.action,
            timestamp: new Date(activity.timestamp).toLocaleString(),
            details: activity.course ? `in ${activity.course}` : "",
          })
        );

        if (isMounted) {
          setRecentActivity(formattedActivities);
        }

        const [userBadgesResponse, allBadgesResponse] = await Promise.all([
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/user-badges/`, {
            headers: authHeaders,
          }),
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/badges/`, {
            headers: authHeaders,
          }),
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
  }, [getAccessToken, loadProfile, isAuthenticated, isInitialized]);

  const renderCalendar = () => {
    if (!currentMonth.first_day || !currentMonth.last_day) return null;

    const firstDay = new Date(currentMonth.first_day);
    const lastDay = new Date(currentMonth.last_day);
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
              currentMonth.year,
              new Date(currentMonth.first_day).getMonth(),
              day
            );
            const dateStr = date.toISOString().split("T")[0];
            const activityCount = activityCalendar[dateStr] || 0;
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

  if (isLoading) {
    return (
      <PageContainer maxWidth="5xl" layout="centered">
        <div className="flex flex-col items-center gap-4 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          <p className="text-sm">Loading profile...</p>
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
              src={imageUrl || "/default-avatar.png"}
              alt="Avatar"
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
              @{profileData.username}
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {profileData.first_name} {profileData.last_name}
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {profileData.email}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Your Goals
            </h3>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Track daily and weekly learning progress.
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
                    {key === "daily" ? "🎯 Daily Goal" : "🗓 Weekly Goal"}
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
                        ✓ Completed!
                      </span>
                    )}
                  </p>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Learning Streak
            </h3>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Visualize your daily activity for the month.
            </p>
          </header>
          {renderCalendar()}
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Statistics
            </h3>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg,#f8fafc)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Balance
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--accent,#111827)]">
                ${profileData.earned_money.toFixed(2)}
              </p>
            </GlassCard>
            <GlassCard
              padding="md"
              className="bg-[color:var(--input-bg,#f8fafc)]/60 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Points
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
                Streak
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--accent,#111827)]">
                {profileData.streak} days
              </p>
              <div className="mt-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                {profileData.streak >= 7 ? (
                  <span className="text-emerald-500">🔥 Hot streak!</span>
                ) : profileData.streak >= 3 ? (
                  <span className="text-amber-400">↑ Keep going!</span>
                ) : (
                  <span>Start your streak</span>
                )}
              </div>
            </GlassCard>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Achievements
            </h3>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badges.length > 0 ? (
              badges.map((userBadge) => (
                <GlassCard
                  key={userBadge.badge.id}
                  padding="md"
                  className={`flex h-36 flex-col items-center justify-center bg-[color:var(--input-bg,#f3f4f6)]/60 text-center transition`}
                  title={`${userBadge.badge.name}\n${
                    userBadge.badge.description || "Earned achievement"
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
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <p className="mt-3 text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {userBadge.earned ? userBadge.badge.name : "Locked"}
                  </p>
                  {userBadge.earned && userBadge.earned_at && (
                    <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                      Earned{" "}
                      {new Date(userBadge.earned_at).toLocaleDateString()}
                    </p>
                  )}
                </GlassCard>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                No badges found
              </p>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Recent Activity
            </h3>
          </header>

          {recentActivity.length > 0 ? (
            <VerticalTimeline
              layout="1-column-left"
              lineColor="var(--border-color, rgba(148,163,184,0.4))"
              className="!pt-0"
            >
              {recentActivity.slice(0, 3).map((activity) => (
                <VerticalTimelineElement
                  key={activity.id}
                  className="vertical-timeline-element"
                  contentStyle={{
                    background: "var(--card-bg, #ffffff)",
                    color: "var(--text-color, #111827)",
                    borderRadius: "16px",
                    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
                    border:
                      "1px solid var(--border-color, rgba(148,163,184,0.4))",
                    padding: "18px",
                  }}
                  contentArrowStyle={{
                    borderRight: "7px solid var(--card-bg, #ffffff)",
                  }}
                  date={activity.timestamp}
                  dateClassName="text-xs text-[color:var(--muted-text,#6b7280)]"
                  icon={
                    <span
                      style={{
                        fontSize: "1.25rem",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                      }}
                    >
                      {activityIcons[activity.type] || activityIcons.default}
                    </span>
                  }
                  iconStyle={{
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {activity.title}
                  </h4>
                  <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                    {activity.details}
                  </p>
                </VerticalTimelineElement>
              ))}
            </VerticalTimeline>
          ) : (
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              No recent activity
            </p>
          )}

          {recentActivity.length > 3 && (
            <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
              Showing the 3 most recent activities of {recentActivity.length}{" "}
              total.
            </p>
          )}
        </section>
      </GlassCard>
      <Chatbot />
    </PageContainer>
  );
}

export default Profile;
