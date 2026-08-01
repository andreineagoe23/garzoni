import React, { useMemo, useState } from "react";
import type {
  StakeRewardRow,
  StreakWagerDto,
  StreakWagerIneligibleReason,
} from "@garzoni/core";
import { GlassCard } from "components/ui";
import { daysLeftToDeadline, previewDeadlineOn } from "./wagerHelpers";

type StreakWagerCardProps = {
  active: StreakWagerDto | null;
  /** Most recent past wagers (won/lost/cancelled), newest first. */
  history: StreakWagerDto[];
  stakeRewardTable: StakeRewardRow[];
  eligible: boolean;
  ineligibleReason: StreakWagerIneligibleReason;
  /** Busy while an open/cancel request is in flight — disables actions. */
  busy: boolean;
  onOpen: (targetDays: number) => void;
  onCancel: (wagerId: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

const DEFAULT_TARGET_DAYS = 7;

function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const StreakWagerCard = ({
  active,
  history,
  stakeRewardTable,
  eligible,
  ineligibleReason,
  busy,
  onOpen,
  onCancel,
  t,
}: StreakWagerCardProps) => {
  const [selectedDays, setSelectedDays] = useState(DEFAULT_TARGET_DAYS);
  const today = useMemo(() => todayIso(), []);

  const selectedRow =
    stakeRewardTable.find((row) => row.target_days === selectedDays) ??
    stakeRewardTable[0] ??
    null;

  if (active) {
    const daysLeft = daysLeftToDeadline(active.deadline_on, today);
    return (
      <GlassCard padding="md" className="">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-content-primary">
            {t("wagers.title")}
          </h3>
          <span className="rounded-full bg-[color:var(--color-brand-primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-primary)]">
            {t("wagers.active.badge")}
          </span>
        </div>

        <p className="mt-3 text-sm text-content-muted">
          {t("wagers.active.stakeLine", {
            stake: active.stake_points,
            reward: active.reward_points,
            coins: active.reward_coins,
          })}
        </p>

        <p className="mt-1 text-xl font-bold text-[color:var(--color-brand-primary)]">
          {daysLeft <= 0
            ? t("wagers.active.endsToday")
            : t("wagers.active.daysLeft", { count: daysLeft })}
        </p>

        {active.can_cancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm(
                `${t("wagers.active.cancelConfirmTitle")}\n\n${t(
                  "wagers.active.cancelConfirmBody",
                  { stake: active.stake_points }
                )}`
              );
              if (!confirmed) return;
              onCancel(active.id);
            }}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-[color:var(--color-state-error)]/40 px-4 py-2 text-xs font-semibold text-[color:var(--color-state-error)] transition hover:bg-[color:var(--color-state-error)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("wagers.active.cancel")}
          </button>
        ) : (
          <p className="mt-4 text-xs text-content-muted">
            {t("wagers.active.cancelWindowClosed")}
          </p>
        )}
      </GlassCard>
    );
  }

  const recentHistory = history.slice(0, 3);

  return (
    <GlassCard padding="md" className="">
      <h3 className="text-lg font-semibold text-content-primary">
        {t("wagers.title")}
      </h3>
      <p className="mt-1 text-sm text-content-muted">{t("wagers.subtitle")}</p>

      {!eligible ? (
        <p className="mt-4 text-sm text-content-muted">
          {ineligibleReason === "streak_too_low"
            ? t("wagers.eligibility.streakTooLow")
            : ineligibleReason === "insufficient_points"
              ? t("wagers.eligibility.insufficientPoints")
              : t("wagers.eligibility.activeExists")}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {stakeRewardTable.map((row) => {
              const isSelected = row.target_days === selectedDays;
              return (
                <button
                  key={row.target_days}
                  type="button"
                  onClick={() => setSelectedDays(row.target_days)}
                  className={`flex min-w-[76px] flex-col items-center rounded-2xl border px-4 py-2 text-sm transition ${
                    isSelected
                      ? "border-[color:var(--color-brand-primary)] bg-[color:var(--color-brand-primary)]/10 text-[color:var(--color-brand-primary)]"
                      : "border-[color:var(--color-border-default)] text-content-primary hover:bg-[color:var(--color-surface-card)]"
                  }`}
                >
                  <span className="font-bold">
                    {t("wagers.open.days", { count: row.target_days })}
                  </span>
                  <span className="text-xs text-content-muted">
                    {t("wagers.open.stakeXp", { stake: row.stake_points })}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedRow ? (
            <p className="mt-3 text-sm font-semibold text-content-muted">
              {t("wagers.open.rewardLine", {
                reward: selectedRow.reward_points,
                coins: selectedRow.reward_coins,
              })}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || !selectedRow}
            onClick={() => {
              if (!selectedRow) return;
              const deadline = previewDeadlineOn(
                selectedRow.target_days,
                today
              );
              const confirmed = window.confirm(
                `${t("wagers.open.confirmTitle", {
                  stake: selectedRow.stake_points,
                  count: selectedRow.target_days,
                })}\n\n${t("wagers.open.confirmBody", {
                  stake: selectedRow.stake_points,
                  date: deadline,
                  reward: selectedRow.reward_points,
                  coins: selectedRow.reward_coins,
                })}`
              );
              if (!confirmed) return;
              onOpen(selectedRow.target_days);
            }}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--color-brand-primary)]/30 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("wagers.open.cta")}
          </button>
        </>
      )}

      {recentHistory.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {recentHistory.map((wager) => (
            <span
              key={wager.id}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                wager.status === "won"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : wager.status === "lost"
                    ? "border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/10 text-[color:var(--color-state-error)]"
                    : "border-[color:var(--color-border-default)] text-content-muted"
              }`}
            >
              {wager.status === "won"
                ? t("wagers.history.won", { reward: wager.reward_points })
                : wager.status === "lost"
                  ? t("wagers.history.lost", { stake: wager.stake_points })
                  : t("wagers.history.cancelled")}
            </span>
          ))}
        </div>
      ) : null}
    </GlassCard>
  );
};

export default React.memo(StreakWagerCard);
