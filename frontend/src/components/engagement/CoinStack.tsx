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
    <GlassCard padding="md" className="">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {coins.map((amount, index) => {
          const unlocked = index < unlockedCoins;
          return (
            <div
              key={amount}
              className={`coin flex h-20 flex-col items-center justify-center rounded-full border text-sm font-semibold shadow-md transition ${
                unlocked
                  ? "border-[color:var(--primary-bright,#2a7347)]/40 bg-[color:var(--primary-soft,rgba(29,83,48,0.10))] text-[color:var(--primary-bright,#2a7347)]"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-content-muted"
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
        <div className="coin next-unlock mt-4 rounded-2xl border border-[color:#2a7347]/40 bg-[color:#2a7347]/10 px-4 py-3 text-center text-xs font-medium text-[color:#2a7347]">
          {t("missions.savings.nextCoin", {
            amount: coinUnit - (balance % coinUnit),
          })}
        </div>
      )}
    </GlassCard>
  );
}

export default CoinStack;
