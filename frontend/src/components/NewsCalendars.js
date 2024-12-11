import React, { useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const NewsCalendars = () => {
  useEffect(() => {
    // TradingView News Widget
    if (!document.getElementById("tradingview-news-widget-script")) {
      const newsWidgetScript = document.createElement("script");
      newsWidgetScript.id = "tradingview-news-widget-script";
      newsWidgetScript.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      newsWidgetScript.async = true;
      newsWidgetScript.innerHTML = JSON.stringify({
        width: "100%",
        height: "600",
        feedMode: "all_symbols",
        colorTheme: "light",
        isTransparent: false,
        displayMode: "regular",
        locale: "en",
      });
      document
        .getElementById("tradingview-news-widget")
        .appendChild(newsWidgetScript);
    }
  }, []);

  return (
    <div className="container">
      <div className="tool-section">
        <h3>News & Calendars</h3>
        <p>Stay informed with the latest news and upcoming events:</p>
        <div className="row">
          <div className="col-md-12 mb-3">
            <div className="border p-3 rounded">
              <iframe
                src="https://widget.myfxbook.com/widget/calendar.html?lang=en&impacts=0,1,2,3&countries=Australia,Belgium,Canada,China,France,Germany,Italy,Japan,Mexico,New%20Zealand,Romania,South%20Africa,Spain,Switzerland,United%20Kingdom,United%20States"
                style={{ border: "0", width: "100%", height: "800px" }}
                title="Economic Calendar"
              ></iframe>
              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    width: "fit-content",
                    margin: "auto",
                    fontFamily: "roboto, sans-serif!important",
                    fontSize: "13px",
                    color: "#666666",
                  }}
                >
                  <a
                    href="https://www.myfxbook.com/forex-economic-calendar?utm_source=widget13&utm_medium=link&utm_campaign=copyright"
                    title="Economic Calendar"
                    className="myfxbookLink"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <b style={{ color: "#666666" }}>Economic Calendar</b>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-12 mb-3">
            <div className="border p-3 rounded">
              <div id="tradingview-news-widget"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCalendars;
