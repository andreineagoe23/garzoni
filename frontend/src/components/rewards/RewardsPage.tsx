import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageContainer from "components/common/PageContainer";
import ShopItems from "./ShopItems";
import DonationCauses from "./DonationCauses";
import { GlassCard, GlassButton } from "components/ui";
import UpsellModal from "components/billing/UpsellModal";
import { fetchEntitlements } from "services/entitlementsService";
import { queryKeys, staleTimes } from "lib/reactQuery";
import { formatNumber, getLocale } from "utils/format";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import ShareAchievementButton from "./ShareAchievementButton";
import apiClient from "services/httpClient";

function RewardsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "donate" ? "donate" : "shop";
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [lockedFeature, setLockedFeature] = useState(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const queryClient = useQueryClient();
  const locale = getLocale();
  const [balanceFlash, setBalanceFlash] = useState(false);

  const { data: entitlementsData } = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: fetchEntitlements,
    staleTime: staleTimes.entitlements,
  });

  const downloadsFeature = entitlementsData?.data?.features?.downloads;
  const { data: profileResponse } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => apiClient.get("/userprofile/"),
    staleTime: staleTimes.profile,
  });

  const balance = useMemo(() => {
    const payload = profileResponse?.data || {};
    const earned =
      payload?.earned_money ?? payload?.user_data?.earned_money ?? 0;
    return Number.parseFloat(String(earned)) || 0;
  }, [profileResponse]);

  React.useEffect(() => {
    if (!profileResponse) return;
    setBalanceFlash(true);
    const timeout = window.setTimeout(() => setBalanceFlash(false), 500);
    return () => window.clearTimeout(timeout);
  }, [balance, profileResponse]);

  const handlePurchase = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  };

  const handleDonation = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  };

  return (
    <PageContainer
      maxWidth="6xl"
      layout="none"
      innerClassName="flex flex-col gap-8"
    >
      <GlassCard
        ref={shareCardRef}
        padding="md"
        className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-[color:var(--text-color)]">
            {t("rewards.title")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text)]">
            {t("rewards.subtitle")}
          </p>
        </div>
        <div
          className={`rounded-3xl border border-[color:var(--border-color)] bg-[color:var(--bg-color)]/60 backdrop-blur-sm px-5 py-4 text-sm text-[color:var(--muted-text)] shadow-inner shadow-[color:var(--shadow-color)] transition-transform ${
            balanceFlash ? "scale-[1.02]" : ""
          }`}
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text)]">
            {t("rewards.balanceLabel")}
          </span>
          <p className="text-2xl font-bold text-[color:var(--text-color)]">
            {formatNumber(balance, locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {t("rewards.coins")}
          </p>
        </div>
      </GlassCard>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <GlassButton
            variant={activeTab === "shop" ? "active" : "ghost"}
            onClick={() => setSearchParams({ tab: "shop" })}
          >
            {t("rewards.tabs.shop")}
          </GlassButton>
          <GlassButton
            variant={activeTab === "donate" ? "active" : "ghost"}
            onClick={() => setSearchParams({ tab: "donate" })}
          >
            {t("rewards.tabs.donate")}
          </GlassButton>
        </div>
        <ShareAchievementButton
          targetRef={shareCardRef}
          downloadsFeature={downloadsFeature}
          onLocked={() => {
            setLockedFeature("downloads");
            setShowUpsell(true);
          }}
        />
      </div>
      <p className="text-xs text-[color:var(--muted-text)] -mt-4">
        {t("rewards.refreshNote")}
      </p>

      <GlassCard padding="lg">
        {activeTab === "shop" ? (
          <ShopItems onPurchase={handlePurchase} balance={balance} />
        ) : (
          <DonationCauses onDonate={handleDonation} balance={balance} />
        )}
      </GlassCard>
      <UpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
        feature={lockedFeature || "downloads"}
      />
    </PageContainer>
  );
}

export default RewardsPage;
