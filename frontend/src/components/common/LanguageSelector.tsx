import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "constants/i18n";

const LANGUAGE_FLAGS: Record<
  (typeof SUPPORTED_LANGUAGES)[number]["code"],
  string
> = {
  en: "🇬🇧",
  ro: "🇷🇴",
  es: "🇪🇸",
};

type LanguageSelectorProps = {
  /** Inline block for parent menus (no separate toggle button). */
  variant?: "default" | "menuSection";
};

const LanguageSelector = ({ variant = "default" }: LanguageSelectorProps) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentLanguage = useMemo(() => {
    const raw = i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE;
    return raw.split("-")[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  const currentFlag =
    LANGUAGE_FLAGS[currentLanguage as keyof typeof LANGUAGE_FLAGS] ?? "🌐";
  const currentLabel = useMemo(
    () => t(`language.option.${currentLanguage}`),
    [currentLanguage, t]
  );

  useEffect(() => {
    if (variant === "menuSection") {
      return;
    }
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [variant]);

  const handleLanguageSelect = (
    nextLanguage: (typeof SUPPORTED_LANGUAGES)[number]["code"]
  ) => {
    if (nextLanguage === currentLanguage) {
      setIsOpen(false);
      return;
    }
    i18n.changeLanguage(nextLanguage);
    setIsOpen(false);
  };

  if (variant === "menuSection") {
    return (
      <div className="w-full px-1">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))]">
          {t("language.label")}
        </p>
        <div className="flex flex-col gap-0.5">
          {SUPPORTED_LANGUAGES.map((language) => {
            const label = t(`language.option.${language.code}`);
            const isComingSoon = Boolean(
              "comingSoon" in language && language.comingSoon
            );
            const isActive = language.code === currentLanguage;
            return (
              <button
                key={language.code}
                type="button"
                role="menuitem"
                onClick={
                  isComingSoon
                    ? undefined
                    : () => handleLanguageSelect(language.code)
                }
                aria-disabled={isComingSoon}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all duration-200 ease-in-out ${
                  isActive
                    ? "bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] text-[color:var(--color-text-primary,var(--text-color,#111827))]"
                    : isComingSoon
                      ? "cursor-not-allowed text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] opacity-60"
                      : "text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] hover:bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.06)))] hover:text-[color:var(--color-text-primary,var(--text-color,#111827))]"
                }`}
              >
                <span className="text-sm" aria-hidden="true">
                  {LANGUAGE_FLAGS[language.code] ?? "🌐"}
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t("language.label")}
        title={currentLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 text-[13px] text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring-focus,var(--primary,#1d5330))]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span aria-hidden="true">{currentFlag}</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={t("language.label")}
          className="absolute right-0 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.12)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/95 p-1 shadow-lg backdrop-blur"
        >
          {SUPPORTED_LANGUAGES.map((language) => {
            const label = t(`language.option.${language.code}`);
            const isComingSoon = Boolean(
              "comingSoon" in language && language.comingSoon
            );
            const isActive = language.code === currentLanguage;
            return (
              <button
                key={language.code}
                type="button"
                role="menuitem"
                onClick={
                  isComingSoon
                    ? undefined
                    : () => handleLanguageSelect(language.code)
                }
                aria-disabled={isComingSoon}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all duration-200 ease-in-out ${
                  isActive
                    ? "bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] text-[color:var(--color-text-primary,var(--text-color,#111827))]"
                    : isComingSoon
                      ? "cursor-not-allowed text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] opacity-60"
                      : "text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] hover:bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.06)))] hover:text-[color:var(--color-text-primary,var(--text-color,#111827))]"
                }`}
              >
                <span className="text-sm" aria-hidden="true">
                  {LANGUAGE_FLAGS[language.code] ?? "🌐"}
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSelector;
