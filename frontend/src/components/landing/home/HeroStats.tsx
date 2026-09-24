import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchPublicStats, queryKeys } from "@garzoni/core";
import { compactCount, decimal } from "./format";

/**
 * Live figures from /api/public/stats/: the App Store rating, learner accounts and
 * how many learners are on a streak right now. A figure that is unavailable or zero
 * is left out rather than shown as a placeholder.
 */
export default function HeroStats() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.publicStats(),
    queryFn: () => fetchPublicStats().then((res) => res.data),
    staleTime: 10 * 60_000,
  });

  // Holds the row's height while the numbers load, so the copy above it and the
  // globe caption it lines up with don't jump.
  const placeholder = (
    <div className="gzh-stats" aria-hidden="true">
      <div className="gzh-stat gzh-stat--placeholder">
        <span className="gzh-stat__value">0</span>
        <span className="gzh-stat__label">&nbsp;</span>
      </div>
    </div>
  );

  if (!data) return placeholder;

  const items: Array<{ key: string; value: React.ReactNode; label: string }> =
    [];
  if (data.app_store_rating) {
    items.push({
      key: "rating",
      value: (
        <>
          {decimal(data.app_store_rating.average)}{" "}
          <span className="gzh-stat__star">★</span>
        </>
      ),
      label: t("welcome.stats.rating"),
    });
  }
  if (data.learners > 0) {
    items.push({
      key: "learners",
      value: compactCount(data.learners),
      label: t("welcome.stats.learners", { count: data.learners }),
    });
  }
  if (data.on_streak > 0) {
    items.push({
      key: "streak",
      value: compactCount(data.on_streak),
      label: t("welcome.stats.onStreak", { count: data.on_streak }),
    });
  }
  if (!items.length) return placeholder;

  return (
    <div className="gzh-stats">
      {items.map((item) => (
        <div key={item.key} className="gzh-stat">
          <span className="gzh-stat__value">{item.value}</span>
          <span className="gzh-stat__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
