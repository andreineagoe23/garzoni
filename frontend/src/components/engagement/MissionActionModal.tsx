import React from "react";
import { Modal } from "components/ui";
import type { MissionActionKind } from "@garzoni/core";
import CoinStack from "./CoinStack";
import FactCard from "./FactCard";

type Fact = { id?: number; category?: string; text?: string };

type MissionActionModalProps = {
  kind: MissionActionKind | null;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onClose: () => void;
  // savings
  virtualBalance: number;
  savingsAmount: string;
  setSavingsAmount: React.Dispatch<React.SetStateAction<string>>;
  onSavingsSubmit: (event: React.FormEvent) => void;
  // fact
  currentFact: Fact | null | undefined;
  onMarkFactRead: () => void;
  onLoadFact: () => void;
};

/**
 * The savings jar and the fact reader used to live inline inside every mission
 * card, which is what made the board so tall. They open from the row CTA now.
 */
const MissionActionModal = ({
  kind,
  isDaily,
  t,
  onClose,
  virtualBalance,
  savingsAmount,
  setSavingsAmount,
  onSavingsSubmit,
  currentFact,
  onMarkFactRead,
  onLoadFact,
}: MissionActionModalProps) => {
  if (kind !== "savings" && kind !== "fact") return null;

  const title =
    kind === "savings"
      ? t("missions.action.savingsTitle")
      : t("missions.action.factTitle");

  return (
    <Modal isOpen title={title} onClose={onClose}>
      {kind === "savings" ? (
        <div className="space-y-4">
          <CoinStack
            balance={virtualBalance}
            coinUnit={isDaily ? 1 : 10}
            target={isDaily ? 10 : 100}
          />
          <form
            onSubmit={onSavingsSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="number"
              value={savingsAmount}
              onChange={(event) => setSavingsAmount(event.target.value)}
              placeholder={
                isDaily
                  ? t("missions.savings.placeholderDaily")
                  : t("missions.savings.placeholderWeekly")
              }
              className="app-input flex-1 rounded-full py-2"
              aria-label={t("missions.cta.addSavings")}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
            >
              {t("missions.savings.add")}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <FactCard fact={currentFact ?? null} onMarkRead={onMarkFactRead} />
          {!currentFact ? (
            <button
              type="button"
              onClick={onLoadFact}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-brand-primary)] transition hover:bg-[color:var(--color-brand-primary)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
            >
              {t("missions.facts.tryAgain")}
            </button>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default MissionActionModal;
