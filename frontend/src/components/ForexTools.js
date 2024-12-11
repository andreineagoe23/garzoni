import React, { useEffect } from "react";

const ForexTools = () => {
  useEffect(() => {
    const loadPositionSizeCalculator = () => {
      const scriptId = "cashbackforex-calculator-script";
      const containerId = "position-size-calculator-524750";

      const initializePositionSizeCalculator = () => {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = ""; // Clear previous widget content
        }

        if (window.RemoteCalc) {
          try {
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
              ContainerWidth: "665",
              HighlightColor: "#ffff00",
              IsDisplayTitle: false,
              IsShowChartLinks: true,
              IsShowEmbedButton: true,
              Lang: "en",
              CompactType: "large",
              Calculator: "position-size-calculator",
              ContainerId: containerId,
            });
          } catch (error) {
            console.error(
              "Error initializing Position Size Calculator:",
              error
            );
          }
        }
      };

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.src =
          "https://www.cashbackforex.com/Content/remote/remote-widgets.js";
        script.id = scriptId;
        script.onload = initializePositionSizeCalculator;
        document.body.appendChild(script);
      } else {
        initializePositionSizeCalculator();
      }
    };

    const loadEconomicCalendar = () => {
      const scriptId = "cashbackforex-calendar-script";
      const containerId = "economic-calendar-729729";

      const initializeEconomicCalendar = () => {
        const existingWidget = document.getElementById(containerId);
        if (existingWidget) {
          existingWidget.innerHTML = ""; // Clear previous widget content
        }

        if (window.RemoteCalendar) {
          try {
            window.RemoteCalendar({
              Lang: "en",
              DefaultTime: "today",
              DefaultTheme: "plain",
              Url: "https://www.cashbackforex.com",
              SubPath: "economic-calendar",
              IsShowEmbedButton: true,
              DefaultCountries:
                "AE,CA,CH,CN,DE,ES,EU,FR,GB,IL,IN,JP,RO,RU,SA,US,UK,EMU",
              DefaultImpacts: "HIGH,MEDIUM,LOW,NONE",
              ContainerId: containerId,
            });
          } catch (error) {
            console.error("Error initializing Economic Calendar:", error);
          }
        }
      };

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.src =
          "https://www.cashbackforex.com/Content/remote/remote-calendar-widget.js";
        script.id = scriptId;
        script.onload = initializeEconomicCalendar;
        document.body.appendChild(script);
      } else {
        initializeEconomicCalendar();
      }
    };

    loadPositionSizeCalculator();
    loadEconomicCalendar();

    return () => {
      const calculatorContainer = document.getElementById(
        "position-size-calculator-524750"
      );
      const calendarContainer = document.getElementById(
        "economic-calendar-729729"
      );

      if (calculatorContainer) {
        calculatorContainer.innerHTML = "";
      }
      if (calendarContainer) {
        calendarContainer.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="forex-tools">
      <div className="tool-section">
        <h3>Position Size Calculator</h3>
        <p>
          Calculate the ideal position size for your trades based on risk
          management principles.
        </p>
        <div id="position-size-calculator-524750"></div>
      </div>
      <div className="tool-section">
        <h3>Economic Calendar</h3>
        <p>
          Stay informed about global economic events and their potential impact
          on currency markets.
        </p>
        <div id="economic-calendar-729729"></div>
      </div>
    </div>
  );
};

export default ForexTools;
