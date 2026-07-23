/**
 * ProfileCompletenessRing — small progress ring nudging the user toward the
 * next missing profile item (UX plan 3.3, endowment + goal-gradient).
 *
 * Backend adds `profile_completeness` (0-100) and `completeness_next` (a key)
 * to the profile payload. Both are read defensively — when absent, or once the
 * profile is 100% complete, the component renders nothing.
 *
 * Copy is hardcoded English (no translated keys exist for these hints yet).
 */
import React from "react";
import { useNavigate } from "react-router-dom";

/** Maps a `completeness_next` key to a human hint + in-app destination. */
const NEXT_ITEM: Record<string, { hint: string; to: string }> = {
  first_lesson: {
    hint: "Complete your first lesson",
    to: "/personalized-path",
  },
  avatar: { hint: "Add a profile photo", to: "/profile" },
  // Backend emits "name" (services/profile.py), not "names" — the mismatch made
  // the highest-value nudge fall through to the generic no-CTA branch.
  name: { hint: "Add your name", to: "/profile" },
  // The push toggle lives in Settings, not on the page you are already on.
  notifications: { hint: "Turn on notifications", to: "/settings" },
  tool: { hint: "Try one AI tool", to: "/tools" },
  questionnaire: { hint: "Finish your questionnaire", to: "/onboarding" },
};

export interface ProfileCompletenessRingProps {
  /** 0-100 completeness score from the profile payload; undefined = hide. */
  completeness?: number | null;
  /** Key of the next missing item, e.g. "avatar". */
  nextKey?: string | null;
  className?: string;
}

const ProfileCompletenessRing: React.FC<ProfileCompletenessRingProps> = ({
  completeness,
  nextKey,
  className = "",
}) => {
  const navigate = useNavigate();

  if (
    completeness === null ||
    completeness === undefined ||
    !Number.isFinite(completeness)
  ) {
    return null;
  }
  const value = Math.max(0, Math.min(100, Math.round(completeness)));
  if (value >= 100) return null;

  const next = nextKey ? NEXT_ITEM[nextKey] : undefined;

  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] p-4 ${className}`}
      aria-label={`Profile ${value}% complete`}
    >
      <svg
        className="h-12 w-12 shrink-0"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-border-default, #e2e8f0)"
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-brand-primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
        />
        <text
          x="24"
          y="28"
          textAnchor="middle"
          fontSize="12"
          fontWeight={700}
          fill="var(--color-content-primary, #0f172a)"
        >
          {value}%
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-content-primary">
          Profile {value}% complete
        </p>
        {next ? (
          <button
            type="button"
            onClick={() => navigate(next.to)}
            className="mt-0.5 text-left text-xs font-medium text-[color:var(--color-brand-primary)] underline-offset-2 transition hover:underline"
          >
            Next: {next.hint} →
          </button>
        ) : (
          <p className="mt-0.5 text-xs text-content-muted">
            Finish setting up your profile.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfileCompletenessRing;
