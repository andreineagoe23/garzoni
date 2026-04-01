from celery import shared_task

from finance.views import refresh_news_feed_cache


@shared_task
def refresh_news_feed_cache_task():
    """Prewarm finance news cache so API reads are fast and non-blocking."""
    refresh_news_feed_cache()
