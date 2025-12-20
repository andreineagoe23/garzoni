import React, { useEffect } from "react";

const NewsCalendars = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://www.cashbackforex.com/Content/remote/remote-widgets.js";
    script.async = true;
    script.onload = () => {
      if (window.RemoteCalc) {
        window.RemoteCalc({
          Url: "https://www.cashbackforex.com",
          ContainerWidth: "100%",
          HighlightColor: "#ffff00",
          IsDisplayTitle: false,
          IsShowChartLinks: false,
          IsShowEmbedButton: false,
          Lang: "en",
          CompactType: "full",
          Calculator: "economic-calendar",
          ContainerId: "economic-calendar-widget",
          analytics: false,
          logging: false,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      const container = document.getElementById("economic-calendar-widget");
      if (container) container.innerHTML = "";
    };
  }, []);

  return (
    <section className="space-y-4">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          News & Economic Calendar
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Stay updated with key financial events and news that move the markets.
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-4 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div
          id="economic-calendar-widget"
          className="h-[600px] overflow-hidden rounded-2xl bg-[color:var(--bg-color,#f8fafc)]"
        />
      </div>
    </section>
  );
};

export default NewsCalendars;
