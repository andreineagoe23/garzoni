import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import ShopItems from "./ShopItems";
import DonationCauses from "./DonationCauses";
import { GlassCard, GlassButton } from "components/ui";

function RewardsPage() {
  const [activeTab, setActiveTab] = useState("shop");
  const [balance, setBalance] = useState("0.00");
  const didFetchRef = useRef(false);
  const shareCardRef = useRef(null);
  const { loadProfile } = useAuth();

  const fetchBalance = useCallback(
    async (force = false) => {
      try {
        const profilePayload = await loadProfile(
          force ? { force: true } : undefined
        );
        const earned =
          profilePayload?.user_data?.earned_money ??
          profilePayload?.earned_money ??
          0;
        const normalized = Number.parseFloat(earned) || 0;
        setBalance(normalized.toFixed(2));
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    },
    [loadProfile]
  );

  useEffect(() => {
    if (!didFetchRef.current) {
      didFetchRef.current = true;
      fetchBalance(false);
    }
  }, [fetchBalance]);

  const handlePurchase = useCallback(async () => {
    await fetchBalance(true);
  }, [fetchBalance]);

  const handleDonation = useCallback(async () => {
    await fetchBalance(true);
  }, [fetchBalance]);

  const handleShare = useCallback(async () => {
    try {
      const target = shareCardRef.current;
      if (!target) return;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target);
      const dataUrl = canvas.toDataURL("image/png");

      if (navigator.share) {
        await navigator.share({
          title: "I just unlocked rewards on Monevo!",
          text: "Check out my latest achievement.",
          url: dataUrl,
        });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "monevo-achievement.png";
        link.click();
        toast.success("Share image downloaded. Post it anywhere!");
      }
    } catch (error) {
      console.error("Share failed", error);
      toast.error("Unable to generate share image right now.");
    }
  }, []);

  return (
    <PageContainer maxWidth="6xl" layout="none" innerClassName="flex flex-col gap-8">
      <GlassCard
        ref={shareCardRef}
        padding="md"
        className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
            Rewards
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Spend your coins on exclusive rewards or donate to causes that matter.
          </p>
        </div>
        <div className="rounded-3xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--bg-color,#f8fafc)]/60 backdrop-blur-sm px-5 py-4 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-[color:var(--shadow-color,rgba(0,0,0,0.05))]" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            Available Balance
          </span>
          <p className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {balance} coins
          </p>
        </div>
      </GlassCard>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <GlassButton
            variant={activeTab === "shop" ? "active" : "ghost"}
            onClick={() => setActiveTab("shop")}
          >
            Shop
          </GlassButton>
          <GlassButton
            variant={activeTab === "donate" ? "active" : "ghost"}
            onClick={() => setActiveTab("donate")}
          >
            Donate
          </GlassButton>
        </div>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            Coins refresh automatically after each purchase or donation.
          </p>
          <GlassButton variant="ghost" onClick={handleShare}>
            Share achievement card
          </GlassButton>
        </div>

      <GlassCard padding="lg">
        {activeTab === "shop" ? (
          <ShopItems onPurchase={handlePurchase} />
        ) : (
          <DonationCauses onDonate={handleDonation} />
        )}
      </GlassCard>
    </PageContainer>
  );
}

export default RewardsPage;
