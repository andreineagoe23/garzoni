"""Latest price and recent daily closes for any Yahoo symbol, for the AI tutor."""

from __future__ import annotations

import datetime
import logging
import re
from typing import Dict, Optional
from urllib.parse import quote

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

MAX_DAYS = 20
_CACHE_TTL_SECONDS = 300
_REQUEST_TIMEOUT_SECONDS = 6
# Yahoo answered 429 to a full Chrome UA and to the requests default, 200 to this (2026-11-05).
_USER_AGENT = "Mozilla/5.0"
_SYMBOL_RE = re.compile(r"^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$")
_UNAVAILABLE = {"error": "Market data is temporarily unavailable."}


def _fetch_chart(symbol: str) -> Optional[Dict]:
    response = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol, safe='')}",
        params={"range": "1mo", "interval": "1d"},
        headers={"User-Agent": _USER_AGENT, "Accept": "*/*"},
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    results = (response.json().get("chart") or {}).get("result") or []
    return results[0] if results else None


def get_recent_prices(symbol: str, days: int = 5) -> Dict:
    symbol = (symbol or "").strip().upper()
    if not _SYMBOL_RE.match(symbol):
        return {"error": f"Invalid symbol: {symbol!r}"}
    days = max(1, min(int(days), MAX_DAYS))

    cache_key = f"market-history:v1:{symbol}"
    chart = cache.get(cache_key)
    if chart is None:
        try:
            chart = _fetch_chart(symbol)
        except (requests.RequestException, ValueError) as exc:
            logger.warning("market_history_fetch_failed symbol=%s err=%s", symbol, exc)
            return dict(_UNAVAILABLE)
        if chart is None:
            return {"error": f"No market data found for {symbol}."}
        cache.set(cache_key, chart, timeout=_CACHE_TTL_SECONDS)

    meta = chart.get("meta") or {}
    quotes = (chart.get("indicators") or {}).get("quote") or [{}]
    # Bar timestamps are UTC; the offset makes each bar land on its exchange-local trading day.
    utc_offset = datetime.timedelta(seconds=meta.get("gmtoffset") or 0)
    closes = []
    for timestamp, close in zip(chart.get("timestamp") or [], quotes[0].get("close") or []):
        if close is None:
            continue
        moment = datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc) + utc_offset
        closes.append({"date": moment.date().isoformat(), "close": round(close, 4)})
    if not closes:
        return {"error": f"No market data found for {symbol}."}

    recent = closes[-days:]
    first_close, last_close = recent[0]["close"], recent[-1]["close"]
    period_change_pct = (
        round((last_close - first_close) / first_close * 100, 2) if first_close else None
    )
    market_time = meta.get("regularMarketTime")
    return {
        "symbol": meta.get("symbol") or symbol,
        "name": meta.get("longName") or meta.get("shortName") or symbol,
        "currency": meta.get("currency"),
        "latest_price": meta.get("regularMarketPrice"),
        "latest_price_time_utc": (
            datetime.datetime.fromtimestamp(market_time, datetime.timezone.utc).isoformat()
            if market_time
            else None
        ),
        "daily_closes": recent,
        "change_pct_over_period": period_change_pct,
        "note": "The newest close may be an in-progress session if the market is open.",
    }
