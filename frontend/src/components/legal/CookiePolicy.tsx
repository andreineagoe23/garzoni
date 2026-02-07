import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";

const COOKIEBOT_ID = "12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const CookiePolicy = () => {
  const declarationRef = useRef<HTMLDivElement | null>(null);

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
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>Last updated: February 7, 2026</p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Cookie Policy
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            This policy explains what cookies and similar technologies we use,
            and how you can manage your preferences.
          </p>
        </header>

        <div className={contentClass}>
          <h2>1. What cookies are</h2>
          <p>
            Cookies are small text files placed on your device when you visit a
            website. They help with login, security, analytics, and service
            performance.
          </p>

          <h2>2. Cookie categories we use</h2>
          <ul>
            <li>
              <strong>Strictly necessary cookies:</strong> required for core
              functionality such as login, session handling, and security.
            </li>
            <li>
              <strong>Preference cookies:</strong> remember settings (for
              example display choices).
            </li>
            <li>
              <strong>Analytics cookies:</strong> help us understand usage and
              improve product experience.
            </li>
            <li>
              <strong>Marketing cookies:</strong> measure campaign performance
              and ad interactions, where consent is provided.
            </li>
          </ul>

          <h2>3. Managing your consent</h2>
          <p>
            You can change cookie preferences at any time via the cookie banner
            controls or your browser settings. Disabling some cookies may impact
            certain features.
          </p>

          <h2>4. Third-party technologies</h2>
          <p>
            We may use third-party tools such as Cookiebot, analytics tools, and
            advertising tags. These services may set their own cookies according
            to your consent choices.
          </p>

          <h2>5. Cookie declaration</h2>
          <p>
            The live cookie declaration below lists cookies detected on this
            property and their durations/providers.
          </p>
        </div>

        <div
          ref={declarationRef}
          id="cookie-declaration"
          className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-6 text-sm text-[color:var(--text-color,#111827)] shadow-inner shadow-black/5"
        >
          <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
            Loading cookie declaration...
          </p>
        </div>

        <div className={contentClass}>
          <h2>6. Contact</h2>
          <p>
            For cookie questions:{" "}
            <a href="mailto:monevo.educational@gmail.com">
              monevo.educational@gmail.com
            </a>
          </p>
          <p>
            Related pages: <Link to="/privacy-policy">Privacy Policy</Link> and{" "}
            <Link to="/terms-of-service">Terms of Service</Link>
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default CookiePolicy;
