import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";

function ShopItems({ onPurchase }) {
  const [shopItems, setShopItems] = useState([]);
  const didFetchRef = useRef(false);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchShopItems = async () => {
      try {
        const response = await axios.get(
          `${BACKEND_URL}/rewards/shop/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setShopItems(response.data);
      } catch (error) {
        console.error("Error fetching shop items:", error);
      }
    };

    if (!didFetchRef.current) {
      didFetchRef.current = true;
      fetchShopItems();
    }
  }, [getAccessToken]);

  const handlePurchase = async (rewardId) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/purchases/`,
        { reward_id: rewardId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

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
      <GlassCard padding="lg" className="bg-[color:var(--card-bg,#ffffff)]/60 text-sm text-[color:var(--muted-text,#6b7280)]">
        No shop items available right now.
      </GlassCard>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
          Shop
        </h2>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Redeem coins for exclusive rewards and resources.
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
                {item.cost} coins
              </span>
              <button
                type="button"
                onClick={() => handlePurchase(item.id)}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              >
                Buy Now
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
