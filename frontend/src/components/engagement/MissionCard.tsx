import React from "react";
import { GlassCard } from "components/ui";
import { MonevoIcon } from "components/ui/monevoIcons";
import CoinStack from "./CoinStack";
import FactCard from "./FactCard";

type MissionCardProps = {
  mission: any;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  canSwap: boolean;
  onSwap: (missionId: number) => void;
  showSavingsMenu: boolean;
  setShowSavingsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  virtualBalance: number;
  currentFact: any;
  onMarkFactRead: () => void;
  onLoadFact: () => void;
  savingsAmount: string;
  setSavingsAmount: React.Dispatch<React.SetStateAction<string>>;
  onSavingsSubmit: (event: React.FormEvent) => void;
  getLessonRequirement: (mission: any) => number;
  purposeStatement: (mission: any) => string;
};

const MissionCard = ({
  mission,
  isDaily,
  t,
  canSwap,
  onSwap,
  showSavingsMenu,
  setShowSavingsMenu,
  virtualBalance,
  currentFact,
  onMarkFactRead,
  onLoadFact,
  savingsAmount,
  setSavingsAmount,
  onSavingsSubmit,
  getLessonRequirement,
  purposeStatement,
}: MissionCardProps) => {
  const progressPercent = Math.min(100, Math.round(mission.progress ?? 0));
  const isCompleted = mission.status === "completed";

  const progressLabel =
    mission.goal_type === "read_fact" && !isDaily
      ? t("missions.progress.factsCount", {
          count: Math.floor(mission.progress / 20),
        })
      : t("missions.progress.percent", {
          value: progressPercent,
        });

  const progressDetail =
    mission.goal_type === "read_fact" && isDaily
      ? t("missions.progress.readOneFact")
      : mission.goal_type === "read_fact"
        ? t("missions.progress.factsRemaining", {
            count: 5 - Math.floor(mission.progress / 20),
          })
        : mission.goal_type === "complete_lesson"
          ? t("missions.progress.lessonTarget", {
              value: progressPercent,
              lessons: getLessonRequirement(mission),
            })
          : t("missions.progress.complete", {
              value: progressPercent,
            });

  const completedLessons =
    mission.goal_type === "complete_lesson"
      ? Math.min(
          getLessonRequirement(mission),
          Math.round(
            (Math.max(mission.progress, 0) / 100) *
              getLessonRequirement(mission)
          )
        )
      : null;

  return (
    <GlassCard
      padding="lg"
      className="group transition hover:-translate-y-1"
      role="article"
      aria-labelledby={`mission-title-${mission.id}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
      <div className="relative">
        <header className="space-y-3 border-b border-white/20 pb-4">
          <div className="flex items-center justify-between gap-4">
            <h3
              id={`mission-title-${mission.id}`}
              className="text-lg font-semibold text-[color:var(--accent,#111827)]"
            >
              {mission.name}
            </h3>
            <span className="rounded-full bg-[color:var(--primary,#1d5330)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)]">
              {isDaily ? t("missions.badge.daily") : t("missions.badge.weekly")}
            </span>
          </div>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {mission.description}
          </p>
          <p className="text-xs font-semibold text-[color:var(--accent,#ffd700)]">
            {t("missions.why")} {purposeStatement(mission)}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              <span>{t("missions.progress.label")}</span>
              <span className="text-[color:var(--accent,#111827)]">
                {progressLabel}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-[color:var(--input-bg,#f3f4f6)]"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("missions.progress.aria", {
                value: progressPercent,
              })}
            >
              <div
                className="h-full rounded-full bg-[color:var(--primary,#1d5330)] transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              {isCompleted ? (
                <span className="inline-flex items-center gap-2">
                  <MonevoIcon
                    name="sparkles"
                    size={14}
                    className="text-[color:var(--accent,#111827)]"
                  />
                  {t("missions.progress.completed")}
                </span>
              ) : (
                progressDetail
              )}
            </p>
            {completedLessons !== null && (
              <p className="text-[0.7rem] text-[color:var(--muted-text,#6b7280)]">
                {t("missions.progress.levelTarget", {
                  lessons: getLessonRequirement(mission),
                  plural: getLessonRequirement(mission) !== 1 ? "s" : "",
                  completed: completedLessons,
                })}
              </p>
            )}
          </div>
        </header>

        {isCompleted ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 shadow-inner shadow-emerald-500/20">
            <div className="flex items-center justify-between font-semibold">
              <span>{t("missions.complete.title")}</span>
              <span>+{mission.points_reward} XP</span>
            </div>
            <p className="text-[color:var(--muted-text,#047857)]">
              {t("missions.complete.subtitle")}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {canSwap && isDaily && (
              <button
                type="button"
                onClick={() => onSwap(mission.id)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 px-4 py-2 text-xs font-semibold text-[color:var(--accent,#ffd700)] transition hover:bg-[color:var(--accent,#ffd700)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                aria-label={t("missions.swap.aria", {
                  name: mission.name,
                })}
              >
                {t("missions.swap.label")}
              </button>
            )}
            {mission.goal_type === "add_savings" && (
              <GlassCard
                padding="md"
                className="space-y-4 bg-[color:var(--bg-color,#f8fafc)]/60"
              >
                <button
                  type="button"
                  onClick={() => setShowSavingsMenu((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                >
                  {showSavingsMenu
                    ? t("missions.savings.hideJar")
                    : t("missions.savings.showJar")}
                </button>
                {showSavingsMenu && (
                  <div className="space-y-4">
                    <CoinStack
                      balance={virtualBalance}
                      coinUnit={isDaily ? 1 : 10}
                      target={isDaily ? 10 : 100}
                    />
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      {t("missions.savings.suggestedNote")}
                    </p>
                    <form
                      onSubmit={onSavingsSubmit}
                      className="flex flex-col gap-3 sm:flex-row"
                    >
                      <input
                        type="number"
                        value={savingsAmount}
                        onChange={(event) =>
                          setSavingsAmount(event.target.value)
                        }
                        placeholder={
                          isDaily
                            ? t("missions.savings.placeholderDaily")
                            : t("missions.savings.placeholderWeekly")
                        }
                        className="flex-1 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                        disabled={isDaily && isCompleted}
                      />
                      <button
                        type="submit"
                        disabled={isDaily && isCompleted}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDaily && isCompleted
                          ? t("missions.savings.savedToday")
                          : t("missions.savings.add")}
                      </button>
                    </form>
                  </div>
                )}
              </GlassCard>
            )}

            {mission.goal_type === "read_fact" && isDaily && (
              <div className="space-y-3">
                <FactCard fact={currentFact} onMarkRead={onMarkFactRead} />
                {!currentFact && (
                  <button
                    type="button"
                    onClick={onLoadFact}
                    className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#ffd700)] px-4 py-2 text-xs font-semibold text-[color:var(--accent,#ffd700)] transition hover:bg-[color:var(--accent,#ffd700)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                  >
                    {t("missions.facts.tryAgain")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default React.memo(MissionCard);
