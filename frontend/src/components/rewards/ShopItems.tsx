import React, { useEffect, useRef, useState } from "react";
import apiClient from "services/httpClient";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

function ShopItems({ onPurchase }) {
  const { t } = useTranslation();
  const [shopItems, setShopItems] = useState([]);
  const didFetchRef = useRef(false);

  useEffect(() => {
    const fetchShopItems = async () => {
      try {
        const response = await apiClient.get("/rewards/shop/");
        setShopItems(response.data);
      } catch (error) {
        console.error("Error fetching shop items:", error);
      }
    };

    if (!didFetchRef.current) {
      didFetchRef.current = true;
      fetchShopItems();
    }
  }, []);

  const handlePurchase = async (rewardId) => {
    try {
      const response = await apiClient.post("/purchases/", {
        reward_id: rewardId,
      });

      if (response.status === 201) {
        alert("Purchase successful!");
        onPurchase();
      }
    } catch (error) {
      console.error("Error purchasing reward:", error);
      alert(error.response?.data?.error || "Failed to purchase reward.");
    }
  };

  if (!shopItems.length) {
    return (
      <GlassCard
        padding="lg"
        className="bg-[color:var(--card-bg,#ffffff)]/60 text-sm text-[color:var(--muted-text,#6b7280)]"
      >
        {t("rewards.shop.empty")}
      </GlassCard>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
          {t("rewards.tabs.shop")}
        </h2>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("rewards.shop.subtitle")}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shopItems.map((item) => (
          <GlassCard
            key={item.id}
            padding="md"
            className="group flex h-full flex-col gap-4 transition hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
            <div className="relative">
              {item.image && (
                <div className="overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)]">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-40 w-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                  {item.name}
                </h3>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {item.description}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                  {item.cost} {t("rewards.coins")}
                </span>
                <button
                  type="button"
                  onClick={() => handlePurchase(item.id)}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                >
                  {t("rewards.shop.buyNow")}
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

export default ShopItems;
