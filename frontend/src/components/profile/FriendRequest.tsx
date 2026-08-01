import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import { GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";

type Props = {
  /**
   * When true, render nothing once the request count is known to be zero
   * (loading/error states still render). Used on the Leaderboard page,
   * where a persistent empty-state card was pushing content below the
   * fold for the majority of users. Defaults to false so the Profile page
   * keeps showing its empty state.
   */
  hideWhenEmpty?: boolean;
  /** Notified whenever the pending-request count changes (fetch or respond). */
  onRequestsChange?: (count: number) => void;
};

const FriendRequests = ({ hideWhenEmpty = false, onRequestsChange }: Props) => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/friend-requests/");
      setRequests(response.data);
      setHasError(false);
      onRequestsChange?.(response.data.length);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setMessage(t("profile.friendRequests.loadFailed"));
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respondToRequest = async (requestId, action) => {
    try {
      await apiClient.put(`/friend-requests/${requestId}/`, { action });
      setRequests((prev) => {
        const next = prev.filter((request) => request.id !== requestId);
        onRequestsChange?.(next.length);
        return next;
      });
      setMessage(
        action === "accept"
          ? t("profile.friendRequests.accepted")
          : t("profile.friendRequests.declined")
      );
    } catch (error: unknown) {
      console.error(`Error updating request:`, error);
      const e = error as {
        response?: { data?: { error?: string; detail?: string } };
      };
      setMessage(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          t("profile.friendRequests.error")
      );
    }
  };

  // Mirrors the mobile card's rule: hide once we know the count is zero
  // (query settled). Errors still render so failures aren't swallowed.
  if (hideWhenEmpty && !loading && !hasError && requests.length === 0) {
    return null;
  }

  return (
    <GlassCard padding="md" className="transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
            {t("profile.friendRequests.title")}
          </h4>
          <p className="text-sm text-content-muted">
            {t("profile.friendRequests.subtitle")}
          </p>
        </div>
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--accent,#ffd700)]">
          {requests.length}
        </span>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 px-4 py-2 text-sm text-[color:var(--accent,#ffd700)]">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-content-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent,#ffd700)] border-t-transparent" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--color-border-default)] bg-[color:var(--input-bg,#f9fafb)] px-6 py-10 text-center text-content-muted">
            <GarzoniIcon name="inbox" size={40} />
            <p className="text-sm">{t("profile.friendRequests.empty")}</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-4 py-4 shadow-sm shadow-black/5 transition hover:shadow-md md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)]/10 text-xl">
                  <GarzoniIcon name="user" size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-content-primary">
                    {request.sender.username}
                  </p>
                  <p className="text-xs text-content-muted">
                    {t("profile.friendRequests.wantsToConnect")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => respondToRequest(request.id, "accept")}
                  className="inline-flex items-center justify-center rounded-lg bg-[color:var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[color:var(--color-brand-primary)]/30 transition hover:shadow-md hover:shadow-[color:var(--color-brand-primary)]/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--color-brand-primary)]"
                >
                  {t("profile.friendRequests.accept")}
                </button>
                <button
                  type="button"
                  onClick={() => respondToRequest(request.id, "reject")}
                  className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border-default)] px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-[color:var(--color-state-error)]/60 hover:text-[color:var(--color-state-error)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-state-error)]/40"
                >
                  {t("profile.friendRequests.decline")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
};

export default FriendRequests;
