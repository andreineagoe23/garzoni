import React from "react";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

type CoinStackProps = {
  balance: number;
  coinUnit?: number;
  target?: number;
};

function CoinStack({ balance, coinUnit = 10, target = 100 }: CoinStackProps) {
  const { t } = useTranslation();
  const coins = Array.from(
    { length: target / coinUnit },
    (_, index) => (index + 1) * coinUnit
  );
  const unlockedCoins = Math.floor(balance / coinUnit);

  return (
    <GlassCard padding="md" className="bg-[color:var(--bg-color,#f8fafc)]/60">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {coins.map((amount, index) => {
          const unlocked = index < unlockedCoins;
          return (
            <div
              key={amount}
              className={`coin flex h-20 flex-col items-center justify-center rounded-full border text-sm font-semibold shadow-md transition ${
                unlocked
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--muted-text,#6b7280)]"
              }`}
            >
              {"\u00A3"}
              {amount}
              <span className="coin-label mt-1 text-xs font-medium">
                {unlocked
                  ? t("missions.savings.unlocked")
                  : t("missions.savings.locked")}
              </span>
            </div>
          );
        })}
      </div>
      {balance < target && (
        <div className="coin next-unlock mt-4 rounded-2xl border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 px-4 py-3 text-center text-xs font-medium text-[color:var(--accent,#ffd700)]">
          {t("missions.savings.nextCoin", {
            amount: coinUnit - (balance % coinUnit),
          })}
        </div>
      )}
    </GlassCard>
  );
}

export default CoinStack;
