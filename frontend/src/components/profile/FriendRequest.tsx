import React, { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "services/backendUrl";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const FriendRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { getAccessToken } = useAuth();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${BACKEND_URL}/friend-requests/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setRequests(response.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setMessage("Unable to load friend requests right now.");
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
      await axios.put(
        `${BACKEND_URL}/friend-requests/${requestId}/`,
        { action },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setRequests((prev) => prev.filter((request) => request.id !== requestId));
      setMessage(
        action === "accept"
          ? "Friend request accepted!"
          : "Friend request declined."
      );
    } catch (error) {
      console.error(`Error updating request:`, error);
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          "Something went wrong. Please try again."
      );
    }
  };

  return (
    <GlassCard padding="md" className="transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
            Friend Requests
          </h4>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Manage people who want to connect with you.
          </p>
        </div>
        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--accent,#2563eb)]">
          {requests.length}
        </span>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-2 text-sm text-[color:var(--accent,#2563eb)]">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[color:var(--muted-text,#6b7280)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-6 py-10 text-center text-[color:var(--muted-text,#6b7280)]">
            <span className="text-3xl">📭</span>
            <p className="text-sm">No pending requests</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-4 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-4 shadow-sm shadow-black/5 transition hover:shadow-md md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)]/10 text-xl">
                  👤
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                    {request.sender.username}
                  </p>
                  <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                    wants to connect with you
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => respondToRequest(request.id, "accept")}
                  className="inline-flex items-center justify-center rounded-lg bg-[color:var(--primary,#2563eb)] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-md hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--primary,#2563eb)]"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respondToRequest(request.id, "reject")}
                  className="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--error,#dc2626)]/60 hover:text-[color:var(--error,#dc2626)] focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                >
                  Decline
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
