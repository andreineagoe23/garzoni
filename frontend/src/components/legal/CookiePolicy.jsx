import React, { useEffect, useRef } from "react";
import { GlassCard } from "components/ui";

const COOKIEBOT_ID = "12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1";

const CookiePolicy = () => {
  const declarationRef = useRef(null);

  useEffect(() => {
    const container = declarationRef.current;
    if (!container) return;

    container.innerHTML = "";

    const existingScript = document.getElementById("CookieDeclaration");
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = "CookieDeclaration";
    script.src = `https://consent.cookiebot.com/${COOKIEBOT_ID}/cd.js`;
    script.async = true;
    script.dataset.cbid = COOKIEBOT_ID;

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      document
        .querySelectorAll("[data-cookieconsent], .CookiebotAlert")
        .forEach((element) => element.remove());
    };
  }, []);

  return (
    <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4 py-12">
      <GlassCard padding="xl" className="w-full max-w-3xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Cookie Policy
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Manage your cookie preferences and review how we use cookies to
            improve your experience.
          </p>
        </header>
        <div
          ref={declarationRef}
          id="cookie-declaration"
          className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-6 text-sm text-[color:var(--text-color,#111827)] shadow-inner shadow-black/5"
        >
          <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
            Loading cookie declaration...
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default CookiePolicy;
