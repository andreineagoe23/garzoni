import React, { useEffect } from "react";

const ForexTools = () => {
  useEffect(() => {
    const containerId = "position-size-calculator-524750";

    const initializeCalculator = () => {
      try {
        if (window.RemoteCalc && document.getElementById(containerId)) {
          window.RemoteCalc({
            Url: "https://www.cashbackforex.com",
            TopPaneStyle:
              "YmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KCMxYmExYzQgMjAlLCAjNDliOWFkIDQ1JSk7IGJvcmRlcjogc29saWQgMHB4OyBib3JkZXItYm90dG9tOiBub25lOyBjb2xvcjogd2hpdGU7",
            BottomPaneStyle:
              "YmFja2dyb3VuZDogd2hpdGU7IGJvcmRlcjogc29saWQgMXB4ICM3YTdhN2E7IGJvcmRlci10b3A6IG5vbmU7IGNvbG9yOiBibGFjazs=",
            ButtonStyle:
              "YmFja2dyb3VuZDogIzFiYTFjNDsgY29sb3I6IHdoaXRlOyBib3JkZXItcmFkaXVzOiAyMHB4Ow==",
            TitleStyle:
              "dGV4dC1hbGlnbjogbGVmdDsgZm9udC1zaXplOiA0MHB4OyBmb250LXdlaWdodDogNTAwOw==",
            TextboxStyle:
              "YmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IGNvbG9yOiBibGFjazsgYm9yZGVyOiBzb2xpZCAxcHggI2FhYWFhYQ==",
            ContainerWidth: "800",
            HighlightColor: "#ffff00",
            IsDisplayTitle: false,
            IsShowChartLinks: true,
            IsShowEmbedButton: true,
            Lang: "en",
            CompactType: "large",
            Calculator: "position-size-calculator",
            ContainerId: containerId,
            analytics: false,
            logging: false,
            enableAutofocus: false,
            onError: (err) => console.error("Calculator error:", err),
          });
        }
      } catch (error) {
        console.error("Error initializing calculator:", error);
      }
    };

    const loadScript = () => {
      const scriptId = "cashbackforex-calculator-script";

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.src =
          "https://www.cashbackforex.com/Content/remote/remote-widgets.js";
        script.id = scriptId;
        script.onload = () => setTimeout(initializeCalculator, 500);
        script.onerror = () =>
          console.error("Failed to load calculator script");
        document.body.appendChild(script);
      } else {
        initializeCalculator();
      }
    };

    const timer = setTimeout(loadScript, 500);

    return () => {
      clearTimeout(timer);
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = "";
    };
  }, []);

  return (
    <section className="space-y-4">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Position Size Calculator
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Calculate the ideal position size for your trades based on risk
          management principles.
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-6 shadow-xl shadow-black/5">
        <div
          id="position-size-calculator-524750"
          className="minimal-scrollbar overflow-hidden rounded-2xl bg-[color:var(--bg-color,#f8fafc)] px-4 py-4"
        />
      </div>
    </section>
  );
};

export default ForexTools;

