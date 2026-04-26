import logging
from decimal import Decimal

from celery import shared_task
from django.db.models import F

from finance.views import refresh_news_feed_cache

logger = logging.getLogger(__name__)

MIN_CHANGE_PCT = Decimal("2")


@shared_task
def refresh_news_feed_cache_task():
    """Prewarm finance news cache so API reads are fast and non-blocking."""
    refresh_news_feed_cache()


@shared_task
def send_portfolio_push_notifications():
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
