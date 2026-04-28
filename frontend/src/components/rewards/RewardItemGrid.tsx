import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import apiClient from "services/httpClient";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

type RewardType = "shop" | "donate";

type RewardItem = {
  id: number;
  name: string;
  description?: string;
  image?: string;
  cost: number;
  donation_organization?: string;
};

type Props = {
  type: RewardType;
  balance: number;
  onAction: () => Promise<void> | void;
};

const RewardItemGrid = ({ type, balance, onAction }: Props) => {
  const { t } = useTranslation();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const endpoint = type === "shop" ? "/rewards/shop/" : "/rewards/donate/";
  const queryKey = ["rewards", type];
  const isDonate = type === "donate";

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get(endpoint);
      return (response.data || []) as RewardItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const headerTitle = isDonate
    ? t("rewards.tabs.donate")
    : t("rewards.tabs.shop");
  const headerSubtitle = isDonate
    ? t("rewards.donate.subtitle")
    : t("rewards.shop.subtitle");
  const emptyText = isDonate
    ? t("rewards.donate.empty")
    : t("rewards.shop.empty");

  const cardRows = useMemo(() => items, [items]);
  const fallbackRewardImage =
    "https://res.cloudinary.com/daqvqm710/image/upload/f_auto,q_auto,w_64/garzoni/logo/garzoni-logo-square-no-bg.png";

  const handleAction = async (rewardId: number) => {
    try {
      const response = await apiClient.post("/purchases/", {
        reward_id: rewardId,
      });
      if (response.status === 201) {
        toast.success(
          isDonate
            ? t("rewards.donate.donationSuccess")
            : t("rewards.shop.purchaseSuccess")
        );
        setConfirmingId(null);
        await onAction();
      }
    } catch (error) {
      const apiError = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(
        apiError ||
          (isDonate
            ? t("rewards.donate.donationFailed")
            : t("rewards.shop.purchaseFailed"))
      );
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-64 rounded-2xl bg-surface-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!cardRows.length) {
    return (
      <GlassCard padding="lg" className=" text-sm text-content-muted">
        {emptyText}
      </GlassCard>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-content-primary">
          {headerTitle}
        </h2>
        <p className="text-sm text-content-muted">{headerSubtitle}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cardRows.map((item) => {
          const canAfford = balance >= Number(item.cost || 0);
          const isConfirming = confirmingId === item.id;
          return (
            <GlassCard
              key={item.id}
              padding="md"
              className="group flex h-full flex-col gap-4 transition hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-[color:var(--border-color)]">
                  {item.image && !brokenImages[item.id] ? (
                    <img
                      src={
                        item.image.includes("/media/rewards/")
                          ? fallbackRewardImage
                          : item.image
                      }
                      alt={item.name}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                      width={640}
                      height={320}
                      onError={() => {
                        setBrokenImages((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }));
                      }}
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-[color:var(--input-bg)] text-4xl font-bold text-content-muted">
                      {String(item.name || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <h3 className="text-lg font-semibold text-content-primary">
                    {item.name}
                  </h3>
                  <p className="text-sm text-content-muted">
                    {item.description}
                  </p>
                </div>

                <div className="mt-auto space-y-3">
                  <div className="flex flex-col gap-1 text-sm text-content-muted">
                    <span className="text-sm font-semibold text-content-primary">
                      {item.cost} {t("rewards.coins")}
                    </span>
                    {item.donation_organization ? (
                      <span className="text-xs uppercase tracking-wide">
                        {item.donation_organization}
                      </span>
                    ) : null}
                  </div>

                  {isConfirming ? (
                    <button
                      type="button"
                      onClick={() => handleAction(item.id)}
                      disabled={!canAfford}
                      className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white transition ${
                        isDonate
                          ? "bg-[color:var(--primary-bright,#2a7347)] shadow-lg shadow-[color:var(--primary)]/30 hover:shadow-xl hover:shadow-[color:var(--primary)]/40"
                          : "bg-[color:var(--primary)] shadow-lg shadow-[color:var(--primary)]/30 hover:shadow-xl hover:shadow-[color:var(--primary)]/40"
                      } ${!canAfford ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={
                        !canAfford
                          ? t("rewards.shop.insufficientFunds")
                          : undefined
                      }
                    >
                      {t("rewards.confirmAction")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(item.id)}
                      disabled={!canAfford}
                      className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-semibold text-white transition ${
                        isDonate
                          ? "bg-[color:var(--primary-bright,#2a7347)] shadow-lg shadow-[color:var(--primary)]/30 hover:shadow-xl hover:shadow-[color:var(--primary)]/40"
                          : "bg-[color:var(--primary)] shadow-lg shadow-[color:var(--primary)]/30 hover:shadow-xl hover:shadow-[color:var(--primary)]/40"
                      } ${!canAfford ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={
                        !canAfford
                          ? t("rewards.shop.insufficientFunds")
                          : undefined
                      }
                    >
                      {isDonate
                        ? t("rewards.donate.donateNow")
                        : t("rewards.shop.buyNow")}
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
};

export default RewardItemGrid;
