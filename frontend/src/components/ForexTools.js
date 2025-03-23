import React, { useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const ForexTools = () => {
  useEffect(() => {
    const containerId = "position-size-calculator-524750";
    const loadPositionSizeCalculator = () => {
      const scriptId = "cashbackforex-calculator-script";

      const initializePositionSizeCalculator = () => {
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
              onError: (err) => console.error('Calculator error:', err)
            });
          }
        } catch (error) {
          console.error("Error initializing calculator:", error);
        }
      };

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.src = "https://www.cashbackforex.com/Content/remote/remote-widgets.js";
        script.id = scriptId;
        script.onload = () => setTimeout(initializePositionSizeCalculator, 500);
        script.onerror = () => console.error("Failed to load calculator script");
        document.body.appendChild(script);
      } else {
        initializePositionSizeCalculator();
      }
    };

    const timer = setTimeout(loadPositionSizeCalculator, 1000);
    return () => {
      clearTimeout(timer);
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = "";
    };
  }, []);

  return (
    <div className="container mt-5">
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title mb-0">Position Size Calculator</h3>
        </div>
        <div className="card-body">
          <p className="card-text">
            Calculate the ideal position size for your trades based on risk
            management principles.
          </p>
          <div
            id="position-size-calculator-524750"
            className="text-center"
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ForexTools;
