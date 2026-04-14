"""REST endpoints for React Native tools.

The web app uses TradingView embeds and client-side engines; mobile calls these
JSON routes under /api/.
"""

from datetime import date, timedelta

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def _economic_calendar_events():
    """Deterministic sample events anchored on local `date.today()` for dev."""
    today = date.today()
    rows = [
        ("high", "08:30", "US CPI (YoY)", "3.1%", None, "USD"),
        ("high", "14:00", "FOMC Meeting Minutes", "—", None, "USD"),
        ("medium", "09:00", "ECB President Speech", None, None, "EUR"),
        ("high", "13:30", "US Non-Farm Payrolls", "180K", None, "USD"),
        ("medium", "07:00", "UK GDP (QoQ)", "0.2%", None, "GBP"),
        ("low", "01:30", "AUD Balance of Trade", None, None, "AUD"),
        ("medium", "12:30", "US Initial Jobless Claims", "215K", None, "USD"),
        ("high", "15:00", "BOE Official Bank Rate", "5.25%", "5.25%", "GBP"),
        ("low", "23:50", "JPY National CPI", "2.6%", None, "JPY"),
        ("medium", "10:00", "German ZEW Economic Sentiment", "15.2", None, "EUR"),
    ]
    events = []
    for i, (impact, time, name, forecast, actual, currency) in enumerate(rows):
        d = today + timedelta(days=i % 10)
        events.append(
            {
                "id": f"macro-{d.isoformat()}-{i}",
                "date": d.isoformat(),
                "time": time,
                "name": name,
                "impact": impact,
                "forecast": forecast,
                "actual": actual,
                "currency": currency,
            }
        )
    return events


# Mirrors mobile `DEMO_STEPS` so swipe + complete flows match expectations.
_NEXT_STEPS_BODY = {
    "steps": [
        {
            "id": "demo-1",
            "title": "Check your savings rate",
            "description": (
                "Run the Goals Reality Check to see if your savings pace matches "
                "your goals."
            ),
            "category": "action",
            "xp": 10,
        },
        {
            "id": "demo-2",
            "title": "Learn about inflation",
            "description": (
                "Understanding CPI helps you plan purchasing power over time."
            ),
            "category": "learn",
            "xp": 5,
        },
        {
            "id": "demo-3",
            "title": "Explore market indices",
            "description": (
                "Get a feel for major markets before making investment decisions."
            ),
            "category": "explore",
            "xp": 5,
        },
    ],
    "completed_today": 0,
    "limit": 3,
}


class EconomicCalendarMobileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(_economic_calendar_events())


class NextStepsMobileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_NEXT_STEPS_BODY)


class NextStepCompleteMobileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, step_id):
        # Queue state is managed client-side; accept for future analytics / caps.
        return Response({"ok": True})
