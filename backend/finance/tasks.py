import logging
from decimal import Decimal

from celery import shared_task
from django.db.models import F

from finance.views import (
    COINGECKO_ID_MAP,
    _coingecko_bulk_fetch_and_cache,
    _coingecko_read_cached,
    _yahoo_bulk_fetch_and_cache,
    _yahoo_read_cached_quote_details,
    refresh_news_feed_cache,
)

logger = logging.getLogger(__name__)

MIN_CHANGE_PCT = Decimal("2")


@shared_task
def refresh_news_feed_cache_task():
    """Prewarm finance news cache so API reads are fast and non-blocking."""
    refresh_news_feed_cache()


@shared_task(ignore_result=True)
def record_funnel_event_task(
    event_type: str,
    user_id=None,
    status: str = "success",
    session_id: str = "",
    metadata: dict | None = None,
):
    """Async wrapper for record_funnel_event — keeps caller request latency low."""
    from django.contrib.auth import get_user_model
    from finance.utils import record_funnel_event

    user = None
    if user_id is not None:
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            pass

    record_funnel_event(
        event_type,
        user=user,
        status=status,
        session_id=session_id,
        metadata=metadata or {},
    )


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=120,
    retry_kwargs={"max_retries": 3},
)
def send_portfolio_push_notifications(self):
    """
    Daily push: find paper-trade users whose top holding moved >= 2% today,
    send a personalised push, then snapshot current_price → previous_price.
    """
    from django.contrib.auth import get_user_model
    from finance.models import PortfolioEntry
    from notifications.enums import CioTemplate
    from notifications.policy import should_send_push
    from notifications.transactional import TransactionalMessages

    User = get_user_model()

    # Users with at least one paper trade and a push token
    eligible_users = (
        User.objects.filter(
            portfolioentry__is_paper_trade=True,
            profile__expo_push_token__isnull=False,
        )
        .exclude(profile__expo_push_token="")
        .distinct()
    )

    transactional = TransactionalMessages()
    sent = 0

    for user in eligible_users:
        policy = should_send_push(user, "transactional")
        if not policy.allowed:
            continue

        entries = PortfolioEntry.objects.filter(
            user=user,
            is_paper_trade=True,
            current_price__isnull=False,
            previous_price__isnull=False,
        )

        # Find entry with largest absolute % change
        best_entry = None
        best_pct = Decimal("0")
        for entry in entries:
            if not entry.previous_price or entry.previous_price == 0:
                continue
            pct = abs((entry.current_price - entry.previous_price) / entry.previous_price * 100)
            if pct >= MIN_CHANGE_PCT and pct > best_pct:
                best_pct = pct
                best_entry = entry

        if best_entry is None:
            continue

        direction = "up" if best_entry.current_price > best_entry.previous_price else "down"
        portfolio_value = float(
            sum(
                e.calculate_value()
                for e in PortfolioEntry.objects.filter(user=user, is_paper_trade=True)
            )
        )

        ok, err = transactional.send_push(
            CioTemplate.PORTFOLIO_UPDATE,
            user,
            {
                "symbol": best_entry.symbol.upper(),
                "change_pct": f"{float(best_pct):.1f}",
                "direction": direction,
                "portfolio_value": f"{portfolio_value:,.2f}",
            },
        )
        if ok:
            sent += 1
        else:
            logger.warning("portfolio push failed user=%s err=%s", user.id, err)

    # Snapshot prices for next day's delta
    PortfolioEntry.objects.filter(
        is_paper_trade=True,
        current_price__isnull=False,
    ).update(previous_price=F("current_price"))

    logger.info("portfolio push done sent=%d eligible=%d", sent, eligible_users.count())
    return f"sent={sent}"


_YAHOO_ASSET_TYPES = {"stock", "etf", "bond", "commodity", "fund"}
_CRYPTO_ASSET_TYPES = {"crypto"}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=120,
    retry_kwargs={"max_retries": 2},
    ignore_result=True,
)
def update_portfolio_prices_task(self):
    """
    Fetch live market prices for all real (non-paper-trade) portfolio holdings
    and write them to PortfolioEntry.current_price.

    Runs every 30 minutes via Celery Beat. Uses the same Yahoo Finance /
    CoinGecko stack as the Market Explorer so results are already cached.
    """
    from finance.models import PortfolioEntry

    entries = list(
        PortfolioEntry.objects.filter(is_paper_trade=False, symbol__isnull=False)
        .exclude(symbol="")
        .select_for_update(skip_locked=True)
    )

    if not entries:
        return "updated=0"

    # Partition by price source
    stock_symbols: list[str] = []
    crypto_cg_ids: list[str] = []
    symbol_to_cg: dict[str, str] = {}

    for entry in entries:
        sym = entry.symbol.strip().upper()
        sym_low = sym.lower()
        if entry.asset_type in _CRYPTO_ASSET_TYPES or sym_low in COINGECKO_ID_MAP:
            cg_id = COINGECKO_ID_MAP.get(sym_low, sym_low)
            crypto_cg_ids.append(cg_id)
            symbol_to_cg[sym] = cg_id
        else:
            stock_symbols.append(sym)

    # Bulk-fetch (populates cache; skips already-cached)
    if stock_symbols:
        try:
            _yahoo_bulk_fetch_and_cache(list(set(stock_symbols)))
        except Exception as exc:
            logger.warning("update_portfolio_prices: yahoo fetch failed: %s", exc)

    if crypto_cg_ids:
        try:
            _coingecko_bulk_fetch_and_cache(list(set(crypto_cg_ids)))
        except Exception as exc:
            logger.warning("update_portfolio_prices: coingecko fetch failed: %s", exc)

    # Apply prices
    to_update: list[PortfolioEntry] = []
    for entry in entries:
        sym = entry.symbol.strip().upper()
        cg_id = symbol_to_cg.get(sym)
        if cg_id:
            data = _coingecko_read_cached(cg_id)
            price = data.get("price") or 0.0
        else:
            data = _yahoo_read_cached_quote_details(sym)
            price = data.get("price") or 0.0

        if price and price > 0:
            new_price = Decimal(str(price))
            if entry.current_price != new_price:
                entry.previous_price = entry.current_price
                entry.current_price = new_price
                to_update.append(entry)

    if to_update:
        PortfolioEntry.objects.bulk_update(to_update, ["current_price", "previous_price"])

    logger.info(
        "update_portfolio_prices done updated=%d total=%d",
        len(to_update),
        len(entries),
    )
    return f"updated={len(to_update)}"
