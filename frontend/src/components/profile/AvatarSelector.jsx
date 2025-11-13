import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { PencilSquare, X } from "react-bootstrap-icons";
import { useAuth } from "contexts/AuthContext";

const AVATAR_STYLES = [
  { id: "avataaars", name: "People" },
  { id: "bottts", name: "Robots" },
  { id: "initials", name: "Initials" },
  { id: "micah", name: "Micah" },
  { id: "adventurer", name: "Adventurer" },
  { id: "funEmoji", name: "Emoji" },
  { id: "pixelArt", name: "Pixel Art" },
];

const getAvatarUrl = (style, seed) =>
  seed ? `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}` : null;

function AvatarSelector({ currentAvatar, onAvatarChange }) {
  const { getAccessToken, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("avataaars");
  const [seed, setSeed] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let inferredStyle = selectedStyle;
    let inferredSeed = seed;

    if (currentAvatar) {
      const match = currentAvatar.match(
        /avatars\.dicebear\.com\/(?:api|7\.x)\/([^/]+)\/([^.]+)/
      );
      if (match && match.length >= 3) {
        inferredStyle = match[1];
        inferredSeed = decodeURIComponent(match[2]);
      }
    }

    if (!inferredSeed) {
      inferredSeed = Math.random().toString(36).slice(2, 8);
    }

    setSelectedStyle(inferredStyle);
    setSeed(inferredSeed);
    setPreviewAvatar(getAvatarUrl(inferredStyle, inferredSeed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!seed) return;
    setPreviewAvatar(getAvatarUrl(selectedStyle, seed));
  }, [selectedStyle, seed]);

  const quickOptions = useMemo(() => {
    if (!isOpen) return [];
    return Array.from({ length: 6 }, () => {
      const randomSeed = Math.random().toString(36).slice(2, 8);
      return {
        seed: randomSeed,
        url: getAvatarUrl(selectedStyle, randomSeed),
      };
    });
  }, [isOpen, selectedStyle]);

  const closeModal = () => {
    setIsOpen(false);
    setLoading(false);
  };

  const saveAvatar = async () => {
    if (!previewAvatar) return;
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/update-avatar/`,
        { profile_avatar: previewAvatar },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      onAvatarChange(previewAvatar);
      await refreshProfile();
      closeModal();
    } catch (error) {
      console.error("Error updating avatar:", error);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] p-2 text-[color:var(--muted-text,#4b5563)] shadow-sm transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
        aria-label="Change avatar"
      >
        <PencilSquare className="text-base" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="relative w-full max-w-3xl rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between border-b border-[color:var(--border-color,#d1d5db)] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                  Customize Your Avatar
                </h3>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  Pick a style and personalize your look.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-text,#6b7280)] transition hover:bg-[color:var(--input-bg,#f3f4f6)] hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Close avatar selector"
              >
                <X className="text-lg" />
              </button>
            </div>

            <div className="space-y-8 px-6 py-6 sm:px-8">
              <div className="flex flex-col items-center gap-6 lg:flex-row">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-[color:var(--accent,#2563eb)] bg-white/10 shadow-inner">
                    {previewAvatar ? (
                      <img
                        src={previewAvatar}
                        alt="Avatar preview"
                        className="h-36 w-36 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl text-[color:var(--muted-text,#6b7280)]">
                        🙂
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                    Each avatar is generated from your seed text.
                  </p>
                </div>

                <div className="w-full space-y-5">
                  <label className="block text-sm font-medium text-[color:var(--muted-text,#374151)]">
                    Avatar Style
                  </label>
                  <select
                    value={selectedStyle}
                    onChange={(event) => setSelectedStyle(event.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-sm text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                  >
                    {AVATAR_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[color:var(--muted-text,#374151)]">
                      Customization Seed
                    </label>
                    <input
                      type="text"
                      value={seed}
                      onChange={(event) => setSeed(event.target.value)}
                      placeholder="Enter text to customize your avatar"
                      className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-sm text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      Different words create different avatars.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    Quick Options
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSeed(Math.random().toString(36).slice(2, 8))}
                    className="text-xs font-medium text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
                  >
                    Randomize
                  </button>
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                  Click any avatar below to use it.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {quickOptions.map((example, index) => (
                    <button
                      key={`${example.seed}-${index}`}
                      type="button"
                      onClick={() => setSeed(example.seed)}
                      className={`flex h-16 w-16 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
                        seed === example.seed
                          ? "border-[color:var(--accent,#2563eb)] shadow-lg shadow-[color:var(--accent,#2563eb)]/30"
                          : "border-transparent bg-[color:var(--input-bg,#f3f4f6)] hover:border-[color:var(--accent,#2563eb)]/60"
                      }`}
                    >
                      <img
                        src={example.url}
                        alt={`Avatar option ${index + 1}`}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[color:var(--border-color,#d1d5db)] px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] px-5 py-2.5 text-sm font-semibold text-[color:var(--muted-text,#374151)] transition hover:bg-[color:var(--input-bg,#f3f4f6)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAvatar}
                disabled={loading || !previewAvatar}
                className="inline-flex items-center justify-center rounded-lg bg-[color:var(--primary,#2563eb)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-lg hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Saving..." : "Save Avatar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AvatarSelector;

