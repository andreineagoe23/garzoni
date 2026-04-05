import React, { RefObject, useCallback } from "react";
import { GlassButton } from "components/ui";
import { MonevoIcon } from "components/ui/monevoIcons";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { consumeEntitlement } from "services/entitlementsService";
import { queryKeys } from "lib/reactQuery";
import { useTranslation } from "react-i18next";

type DownloadsFeature = {
  enabled?: boolean;
  remaining_today?: number | null;
};

type Props = {
  targetRef: RefObject<HTMLElement>;
  downloadsFeature?: DownloadsFeature;
  onLocked: () => void;
};

const ShareAchievementButton = ({
  targetRef,
  downloadsFeature,
  onLocked,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const guardDownloads = useCallback(async () => {
    if (!downloadsFeature) return true;

    if (!downloadsFeature.enabled || downloadsFeature.remaining_today === 0) {
      onLocked();
      toast.error(
        downloadsFeature.enabled
          ? t("rewards.errors.downloadLimit")
          : t("rewards.errors.downloadsPremium")
      );
      return false;
    }

    try {
      await consumeEntitlement("downloads");
      queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
      return true;
    } catch (error) {
      onLocked();
      const apiError = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(apiError || t("rewards.errors.downloadAllowance"));
      return false;
    }
  }, [downloadsFeature, onLocked, queryClient, t]);

  const handleShare = useCallback(async () => {
    try {
      const allowed = await guardDownloads();
      if (!allowed) return;

      const target = targetRef.current;
      if (!target) return;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target);
      const dataUrl = canvas.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "monevo-achievement.png", {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: t("rewards.share.title"),
          text: t("rewards.share.text"),
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: t("rewards.share.title"),
          text: t("rewards.share.text"),
        });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "monevo-achievement.png";
        link.click();
        toast.success(t("rewards.share.downloaded"));
      }
    } catch {
      toast.error(t("rewards.share.unavailable"));
    }
  }, [guardDownloads, t, targetRef]);

  return (
    <GlassButton
      variant="ghost"
      onClick={handleShare}
      icon={
        <MonevoIcon
          name={
            downloadsFeature && !downloadsFeature.enabled ? "lock" : "download"
          }
          size={16}
        />
      }
      disabled={downloadsFeature?.remaining_today === 0}
    >
      {downloadsFeature?.remaining_today === 0
        ? t("rewards.downloadLimit")
        : t("rewards.shareButton")}
    </GlassButton>
  );
};

export default ShareAchievementButton;
