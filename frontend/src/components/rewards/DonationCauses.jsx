import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";

function DonationCauses({ onDonate }) {
  const [donationCauses, setDonationCauses] = useState([]);
  const didFetchRef = useRef(false);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchDonationCauses = async () => {
      try {
        const response = await axios.get(
          `${BACKEND_URL}/rewards/donate/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setDonationCauses(response.data);
      } catch (error) {
        console.error("Error fetching donation causes:", error);
      }
    };

    if (!didFetchRef.current) {
      didFetchRef.current = true;
      fetchDonationCauses();
    }
  }, [getAccessToken]);

  const handleDonate = async (rewardId) => {
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
        alert("Donation successful!");
        onDonate();
      }
    } catch (error) {
      console.error("Error donating:", error);
      alert(error.response?.data?.error || "Failed to donate.");
    }
  };

  if (!donationCauses.length) {
    return (
      <GlassCard padding="lg" className="bg-[color:var(--card-bg,#ffffff)]/60 text-sm text-[color:var(--muted-text,#6b7280)]">
        No donation causes available right now.
      </GlassCard>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
          Donation Causes
        </h2>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Support meaningful organizations with a portion of your coins.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {donationCauses.map((cause) => (
          <GlassCard
            key={cause.id}
            padding="md"
            className="group flex h-full flex-col gap-4 transition hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
            <div className="relative">
            {cause.image && (
              <div className="overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)]">
                <img
                  src={cause.image}
                  alt={cause.name}
                  className="h-40 w-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                {cause.name}
              </h3>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {cause.description}
              </p>
            </div>
            <div className="mt-auto space-y-3">
              <div className="flex flex-col gap-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                  {cause.cost} coins
                </span>
                {cause.donation_organization && (
                  <span className="text-xs uppercase tracking-wide">
                    {cause.donation_organization}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDonate(cause.id)}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                Donate Now
              </button>
            </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

export default DonationCauses;
