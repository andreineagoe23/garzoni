# finance/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from datetime import datetime, timedelta

from django.utils import timezone
from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.core.cache import cache
from django.http import HttpResponse
from decimal import Decimal, InvalidOperation
import json
import logging
import re
import urllib.parse
from html import unescape
import requests
import stripe
import hashlib
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from django.conf import settings
from finance.throttles import FinanceExternalRateThrottle
from core.http_client import request_with_backoff

from finance.models import (
    FinanceFact,
    UserFactProgress,
    SimulatedSavingsAccount,
    Reward,
    UserPurchase,
    PortfolioEntry,
    FinancialGoal,
)
from django.contrib.auth import get_user_model
from finance.serializers import (
    SimulatedSavingsAccountSerializer,
    RewardSerializer,
    UserPurchaseSerializer,
    PortfolioEntrySerializer,
    FinancialGoalSerializer,
)
from authentication.models import UserProfile
from authentication.services.profile import invalidate_profile_cache
from authentication.tasks import send_subscription_cancelled_email
from authentication.user_display import normalize_display_string
from gamification.models import MissionCompletion
from finance.utils import record_funnel_event
from django.apps import apps
from authentication.entitlements import get_entitlements_for_user, get_user_plan, normalize_plan_id

logger = logging.getLogger(__name__)

# Avoid logging the same missing-config message on every request
_logged_missing_config = set()

# Trusted sources chosen for RSS feeds that provide thumbnails (media:content, media:thumbnail, enclosure, or img in description).
# Fallback: per-source logo URLs (publisher-owned, used only when item has no image).
NEWS_FEEDS = [
    {
        "name": "CNBC Markets",
        "url": "https://www.cnbc.com/id/19854910/device/rss/rss.html",
        "logo_url": "https://www.cnbc.com/favicon.ico",
    },
    {
        "name": "CNBC Top News",
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "logo_url": "https://www.cnbc.com/favicon.ico",
    },
    {
        "name": "BBC Business",
        "url": "https://feeds.bbci.co.uk/news/business/rss.xml",
        "logo_url": "https://www.bbc.com/favicon.ico",
    },
    {
        "name": "NPR Business",
        "url": "https://feeds.npr.org/1006/rss.xml",
        "logo_url": "https://www.npr.org/favicon.ico",
    },
    {
        "name": "WSJ Markets",
        "url": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        "logo_url": "https://www.wsj.com/favicon.ico",
    },
]
SOURCE_LOGO_FALLBACK = {f["name"]: f.get("logo_url") for f in NEWS_FEEDS if f.get("logo_url")}

NEWS_FEED_TIMEOUT_SECONDS = 8
NEWS_CACHE_KEY = "monevo:news-feed:v1"
NEWS_LAST_GOOD_CACHE_KEY = "monevo:news-feed:last-good"
NEWS_CACHE_TTL_SECONDS = 60 * 3  # 3 min for fresher updates

NEWS_CATEGORY_KEYWORDS = {
    "Macro economy": ["inflation", "cpi", "rates", "gdp", "jobs", "fed"],
    "Markets": ["stocks", "equities", "index", "market", "rally", "selloff"],
    "Personal finance": ["mortgage", "savings", "budget", "credit", "loan", "rent"],
    "Crypto": ["bitcoin", "crypto", "ethereum", "blockchain"],
}

NEWS_LESSON_LINKS = {
    "Macro economy": "/all-topics?topic=inflation",
    "Markets": "/all-topics?topic=investing",
    "Personal finance": "/all-topics?topic=budgeting",
    "Crypto": "/all-topics?topic=crypto",
}


def _pick_category(title: str, description: str):
    haystack = f"{title} {description}".lower()
    for category, keywords in NEWS_CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category
    return "Markets"


def _build_context(category: str):
    if category == "Macro economy":
        return (
            "Macro signals often shape savings rates and borrowing costs.",
            "If you save or borrow, these shifts can affect your monthly budget.",
            "Savers and borrowers",
        )
    if category == "Personal finance":
        return (
            "This may influence everyday cash flow or living costs.",
            "Small changes can add up quickly across monthly expenses.",
            "Budgeters and savers",
        )
    if category == "Crypto":
        return (
            "Crypto moves fast and can swing sharply in either direction.",
            "If you hold crypto, volatility can dominate short-term results.",
            "Crypto investors",
        )
    return (
        "Markets can swing based on sentiment and expectations.",
        "Long-term decisions shouldn't be driven by a single headline.",
        "Investors and curious learners",
    )


def _normalize_url(url: str) -> str:
    """Strip tracking and ref params; keep URL stable for dedup and display."""
    if not url or "?" not in url:
        return (url or "").strip()
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    drop = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "fbclid"}
    filtered = {k: v for k, v in qs.items() if k.lower() not in drop}
    new_query = urllib.parse.urlencode(filtered, doseq=True)
    new = parsed._replace(query=new_query)
    return urllib.parse.urlunparse(new)


def _resolve_image_url(url: str, base_link: str) -> str:
    """Resolve relative image URL against the article link (legal: same origin)."""
    if not url or url.startswith(("http://", "https://", "//")):
        return (url or "").strip()
    try:
        base = urllib.parse.urlparse(base_link)
        if url.startswith("//"):
            return base.scheme + ":" + url
        if url.startswith("/"):
            return f"{base.scheme}://{base.netloc}{url}"
        return str(urllib.parse.urljoin(base_link, url))
    except Exception:
        return url.strip()


def _extract_image_url(item, description: str, link: str) -> str | None:
    """Extract thumbnail from RSS/Atom using only feed-provided metadata (legal)."""
    # Media RSS (Yahoo, CNBC, BBC, etc.)
    media_ns = {"media": "http://search.yahoo.com/mrss/"}
    for tag in ("media:content", "media:thumbnail"):
        el = item.find(tag, media_ns)
        if el is not None and el.get("url"):
            return _resolve_image_url(el.get("url"), link)
    # Some feeds use media namespace with different URI
    for ns_uri in ("http://search.yahoo.com/mrss/", "http://rssnamespace.org/media/content/"):
        try:
            media_content = item.find(f"{{{ns_uri}}}content") or item.find(f"{{{ns_uri}}}thumbnail")
            if media_content is not None and media_content.get("url"):
                return _resolve_image_url(media_content.get("url"), link)
        except Exception:
            pass
    # Enclosure (image/*)
    enclosure = item.find("enclosure")
    if enclosure is not None:
        enc_type = (enclosure.get("type") or "").lower()
        if enc_type.startswith("image/") and enclosure.get("url"):
            return _resolve_image_url(enclosure.get("url"), link)
    # Atom link rel="enclosure"
    for link_el in item.findall("link"):
        if (link_el.get("rel") or "").lower() == "enclosure" and link_el.get("href"):
            return _resolve_image_url(link_el.get("href"), link)
    # First img in description (many feeds embed this; same as publisher content)
    if description:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', unescape(description), re.I)
        if match:
            return _resolve_image_url(match.group(1), link)
    return None


def _plain_snippet(html_description: str, max_length: int = 220) -> str:
    """Strip HTML and return a short plain-text snippet for display (real article context)."""
    if not html_description or not html_description.strip():
        return ""
    text = re.sub(r"<[^>]+>", " ", unescape(html_description))
    text = " ".join(text.split()).strip()
    if len(text) <= max_length:
        return text
    return text[: max_length - 3].rsplit(" ", 1)[0] + "…"


def _may_require_subscription(title: str, description: str) -> bool:
    """Heuristic: content may be behind a paywall."""
    haystack = f"{title} {description}".lower()
    return any(
        phrase in haystack
        for phrase in ("subscription", "subscriber", "paywall", "premium only", "members only")
    )


def _parse_rss_items(feed_text: str, source: str):
    """Parse RSS XML into items; returns [] on malformed XML."""
    items = []
    try:
        root = ET.fromstring(feed_text)
    except ET.ParseError:
        return items
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        description = (item.findtext("description") or "").strip()
        image_url = _extract_image_url(item, description, link)
        link = _normalize_url(link)
        pub_date = item.findtext("pubDate")
        published_at = None
        if pub_date:
            try:
                published_at = parsedate_to_datetime(pub_date).isoformat()
            except Exception:
                published_at = None
        if not title or not link:
            continue
        category = _pick_category(title, description)
        what_this_means, why_it_matters, who_should_care = _build_context(category)
        may_paywall = _may_require_subscription(title, description)
        # Legal thumbnails: from RSS first, else publisher favicon (source logo)
        thumbnail_url = image_url or SOURCE_LOGO_FALLBACK.get(source)
        snippet = _plain_snippet(description)
        items.append(
            {
                "id": hashlib.sha256(link.encode("utf-8")).hexdigest()[:16],
                "title": title,
                "url": link,
                "source": source,
                "published_at": published_at,
                "category": category,
                "snippet": snippet or why_it_matters,
                "what_this_means": what_this_means,
                "why_it_matters": why_it_matters,
                "who_should_care": who_should_care,
                "lesson_link": NEWS_LESSON_LINKS.get(category),
                "may_require_subscription": may_paywall,
                "image_url": thumbnail_url,
            }
        )
    return items


class SavingsAccountView(APIView):
    """API view to manage the user's simulated savings account, including retrieving the balance and adding funds."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve the current balance of the user's simulated savings account."""
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            return Response({"balance": float(account.balance)}, status=200)
        except Exception as e:
            logger.error(f"Error getting savings balance: {str(e)}")
            return Response({"error": "Failed to retrieve savings balance"}, status=500)

    def post(self, request):
        """Add funds to the user's simulated savings account and update related missions."""
        try:
            amount = Decimal(str(request.data.get("amount", 0)))
            if amount <= 0:
                return Response({"error": "Amount must be positive"}, status=400)

            today = timezone.now().date()
            user = request.user

            with transaction.atomic():
                # Update savings account
                (
                    account,
                    created,
                ) = SimulatedSavingsAccount.objects.select_for_update().get_or_create(
                    user=user, defaults={"balance": amount}
                )
                if not created:
                    account.balance += amount
                    account.save()

                # Fetch all savings-related missions
                missions = MissionCompletion.objects.select_related("mission").filter(
                    user=user,
                    mission__goal_type="add_savings",
                    status__in=["not_started", "in_progress"],
                )

                for completion in missions:
                    mission_type = completion.mission.mission_type
                    target = Decimal(str(completion.mission.goal_reference.get("target", 100)))

                    # Daily savings: only update once per day
                    if mission_type == "daily":
                        if (
                            completion.completed_at is not None
                            and completion.completed_at.date() == today
                        ):
                            continue  # Already completed today

                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    # Weekly savings: cumulative
                    elif mission_type == "weekly":
                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    completion.save()

                return Response(
                    {"message": "Savings updated!", "balance": float(account.balance)},
                    status=200,
                )

        except (ValueError, InvalidOperation) as e:
            logger.error(f"Invalid amount: {str(e)}")
            return Response({"error": "Invalid numeric value"}, status=400)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}", exc_info=True)
            return Response({"error": "Server error processing savings"}, status=500)


class StockPriceView(APIView):
    """Proxy Alpha Vantage price lookups through the backend."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [FinanceExternalRateThrottle]

    def get(self, request):
        request_id = getattr(request, "request_id", None)
        symbol = request.query_params.get("symbol")
        if not symbol:
            return Response(
                {"error": "Stock symbol is required.", "request_id": request_id},
                status=400,
            )
        if len(symbol) > 12:
            return Response(
                {"error": "Stock symbol is too long.", "request_id": request_id},
                status=400,
            )

        api_key = settings.ALPHA_VANTAGE_API_KEY
        if not api_key:
            if "alpha_vantage" not in _logged_missing_config:
                _logged_missing_config.add("alpha_vantage")
                logger.warning(
                    "ALPHA_VANTAGE_API_KEY is not configured. Set it in .env for live stock/ETF prices."
                )
            return Response(
                {"error": "Price feed unavailable.", "request_id": request_id},
                status=503,
            )

        cache_key = f"alpha_quote_{symbol.upper()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            result = request_with_backoff(
                method="GET",
                url="https://www.alphavantage.co/query",
                params={
                    "function": "GLOBAL_QUOTE",
                    "symbol": symbol,
                    "apikey": api_key,
                },
                allow_retry=True,
                max_attempts=3,
            )
            response = result.response
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Alpha Vantage request failed: %s", exc)
            return Response(
                {"error": "Unable to fetch price data.", "request_id": request_id},
                status=502,
            )

        payload = response.json()
        quote = payload.get("Global Quote", {})
        price_raw = quote.get("05. price")

        try:
            price = float(price_raw) if price_raw is not None else None
        except (TypeError, ValueError):
            price = None

        change_percent_raw = quote.get("10. change percent", "0")
        try:
            change_percent = float(str(change_percent_raw).rstrip("%"))
        except (TypeError, ValueError):
            change_percent = 0.0

        if price is None:
            logger.warning("Alpha Vantage returned no price for symbol %s", symbol)
            return Response(
                {"error": "No price data available.", "request_id": request_id},
                status=502,
            )

        result = {
            "price": price,
            "change": change_percent,
            "changePercent": f"{abs(change_percent):.2f}%",
        }
        cache.set(cache_key, result, timeout=60)
        return Response(result)


class ForexRateView(APIView):
    """Proxy forex rate lookups to keep API keys server-side."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [FinanceExternalRateThrottle]

    def get(self, request):
        request_id = getattr(request, "request_id", None)
        base_currency = request.query_params.get("from")
        quote_currency = request.query_params.get("to")

        if not base_currency or not quote_currency:
            return Response(
                {
                    "error": "Both 'from' and 'to' currencies are required.",
                    "request_id": request_id,
                },
                status=400,
            )

        base_currency = base_currency.upper().replace("LEI", "RON")
        quote_currency = quote_currency.upper().replace("LEI", "RON")

        if len(base_currency) != 3 or len(quote_currency) != 3:
            return Response(
                {
                    "error": "Currencies must be 3-letter ISO codes.",
                    "request_id": request_id,
                },
                status=400,
            )

        cache_key = f"forex_{base_currency}_{quote_currency}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        free_currency_key = settings.FREE_CURRENCY_API_KEY
        exchange_rate_key = settings.EXCHANGE_RATE_API_KEY

        result = None

        if free_currency_key:
            try:
                free_result = request_with_backoff(
                    method="GET",
                    url="https://api.freecurrencyapi.com/v1/latest",
                    params={
                        "apikey": free_currency_key,
                        "base_currency": base_currency,
                        "currencies": quote_currency,
                    },
                    allow_retry=True,
                    max_attempts=3,
                )
                free_response = free_result.response
                free_response.raise_for_status()
                data = free_response.json().get("data", {})
                rate = data.get(quote_currency)
                if rate:
                    result = {"rate": float(rate), "change": 0}
            except requests.RequestException as exc:
                logger.warning("FreeCurrencyAPI lookup failed: %s", exc)

        if result is None and exchange_rate_key:
            try:
                fx_result = request_with_backoff(
                    method="GET",
                    url=f"https://v6.exchangerate-api.com/v6/{exchange_rate_key}/pair/{base_currency}/{quote_currency}",
                    allow_retry=True,
                    max_attempts=3,
                )
                fx_response = fx_result.response
                fx_response.raise_for_status()
                data = fx_response.json()
                conversion_rate = data.get("conversion_rate")
                if conversion_rate:
                    result = {"rate": float(conversion_rate), "change": 0}
            except requests.RequestException as exc:
                logger.warning("ExchangeRate-API lookup failed: %s", exc)

        if result is None:
            return Response(
                {"error": "Unable to fetch forex rate.", "request_id": request_id},
                status=502,
            )

        cache.set(cache_key, result, timeout=120)
        return Response(result)


class CryptoPriceView(APIView):
    """Proxy CoinGecko lookups to shield rate limits and API usage."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [FinanceExternalRateThrottle]

    def get(self, request):
        request_id = getattr(request, "request_id", None)
        crypto_id = request.query_params.get("id")
        crypto_symbol = request.query_params.get("symbol")
        if not crypto_id and not crypto_symbol:
            return Response(
                {"error": "Crypto id is required.", "request_id": request_id},
                status=400,
            )
        raw_value = crypto_id or crypto_symbol
        if raw_value and len(raw_value) > 64:
            return Response(
                {"error": "Crypto id is too long.", "request_id": request_id},
                status=400,
            )

        COINGECKO_ID_MAP = {
            "btc": "bitcoin",
            "bitcoin": "bitcoin",
            "eth": "ethereum",
            "ethereum": "ethereum",
            "sol": "solana",
            "solana": "solana",
            "xrp": "ripple",
            "ada": "cardano",
            "doge": "dogecoin",
            "bnb": "binancecoin",
        }
        crypto_id = (raw_value or "").strip().lower()
        crypto_id = COINGECKO_ID_MAP.get(crypto_id, crypto_id)
        cache_key = f"crypto_{crypto_id}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            result = request_with_backoff(
                method="GET",
                url="https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": crypto_id,
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "include_market_cap": "true",
                },
                allow_retry=True,
                max_attempts=3,
            )
            response = result.response
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("CoinGecko request failed: %s", exc)
            return Response(
                {"error": "Unable to fetch crypto price.", "request_id": request_id},
                status=502,
            )

        payload = response.json().get(crypto_id)
        if not payload:
            return Response({"error": "Crypto not found.", "request_id": request_id}, status=404)

        result = {
            "price": float(payload.get("usd", 0) or 0),
            "change": float(payload.get("usd_24h_change", 0) or 0),
            "marketCap": float(payload.get("usd_market_cap", 0) or 0),
        }

        cache.set(cache_key, result, timeout=60)
        return Response(result)


class FinanceFactView(APIView):
    """API view to manage finance facts, including retrieving unread facts and marking them as read."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve a random unread finance fact for the user."""
        try:
            # Get unread facts
            read_facts = UserFactProgress.objects.filter(user=request.user).values_list(
                "fact_id", flat=True
            )

            fact = (
                FinanceFact.objects.filter(is_active=True)
                .exclude(id__in=read_facts)
                .order_by("?")
                .first()
            )

            if not fact:
                return Response(status=204)

            return Response(
                {"id": fact.id, "text": fact.text, "category": fact.category},
                status=200,
            )

        except Exception as e:
            logger.error(f"Fact fetch error: {str(e)}")
            return Response({"error": "Failed to get finance fact"}, status=500)

    def post(self, request):
        """Mark a finance fact as read and update related missions."""
        try:
            fact_id = request.data.get("fact_id")
            if not fact_id:
                return Response({"error": "Missing fact ID"}, status=400)

            fact = FinanceFact.objects.get(id=fact_id)
            today = timezone.now().date()

            # Prevent duplicate daily fact completion
            already_read_today = UserFactProgress.objects.filter(
                user=request.user, read_at__date=today
            ).exists()

            if already_read_today:
                return Response(
                    {"message": "You already completed today's finance fact."},
                    status=200,
                )

            # Log the fact as read
            UserFactProgress.objects.create(user=request.user, fact=fact)

            # Progress both daily and weekly missions
            completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="read_fact",
                status__in=["not_started", "in_progress"],
            )

            for completion in completions:
                if completion.mission.mission_type == "daily":
                    completion.update_progress()  # 100% on 1st fact
                elif completion.mission.mission_type == "weekly":
                    completion.update_progress()  # +20% each time

            return Response({"message": "Fact marked as read!"}, status=200)

        except FinanceFact.DoesNotExist:
            return Response({"error": "Invalid fact ID"}, status=404)
        except Exception as e:
            logger.error(f"Fact completion error: {str(e)}")
            return Response({"error": "Failed to mark fact"}, status=500)


class SavingsGoalCalculatorView(APIView):
    """API view to manage savings goal calculations and update user savings progress."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Handle POST requests to add a specified amount to the user's savings and update related missions."""
        amount = request.data.get("amount", 0)
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            account.add_to_balance(amount)

            mission_completions = MissionCompletion.objects.filter(
                user=request.user, mission__goal_type="add_savings"
            ).select_related("mission")

            for completion in mission_completions:
                target = completion.mission.goal_reference.get("target", 100)
                progress_increment = (amount / target) * 100
                completion.update_progress(increment=progress_increment, total=100)

            return Response({"message": "Savings updated!"}, status=200)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}")
            return Response({"error": "Savings update failed"}, status=500)


class RewardViewSet(viewsets.ModelViewSet):
    """ViewSet to manage rewards, including retrieving active rewards for shopping or donation."""

    serializer_class = RewardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve rewards filtered by type (shop or donate) if specified."""
        # Get type from query parameters, URL path, or request path
        reward_type = (
            self.request.query_params.get("type")
            or self.kwargs.get("type", None)
            or self._get_type_from_path()
        )
        queryset = Reward.objects.filter(is_active=True)

        if reward_type in ["shop", "donate"]:
            queryset = queryset.filter(type=reward_type)

        return queryset

    def _get_type_from_path(self):
        """Extract reward type from request path."""
        path = self.request.path
        if "/rewards/shop/" in path:
            return "shop"
        elif "/rewards/donate/" in path:
            return "donate"
        return None


class UserPurchaseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user purchases, including listing and creating transactions."""

    serializer_class = UserPurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all purchases made by the authenticated user."""
        return UserPurchase.objects.filter(user=self.request.user)

    def create(self, request):
        """Handle POST requests to process a reward purchase for the user."""
        try:
            reward_id = request.data.get("reward_id")
            if not reward_id:
                return Response({"error": "Missing reward_id"}, status=400)

            user_profile = request.user.profile
            reward = Reward.objects.get(id=reward_id, is_active=True)

            # Check if the user has sufficient funds to purchase the reward
            if user_profile.earned_money < reward.cost:
                return Response({"error": "Insufficient funds"}, status=400)

            # Deduct the reward cost from the user's balance and save the purchase
            user_profile.earned_money -= reward.cost
            user_profile.save()

            purchase = UserPurchase.objects.create(user=request.user, reward=reward)

            return Response(
                {
                    "message": "Transaction successful!",
                    "remaining_balance": float(user_profile.earned_money),
                    "purchase": UserPurchaseSerializer(purchase, context={"request": request}).data,
                },
                status=201,
            )

        except Reward.DoesNotExist:
            return Response({"error": "Reward not found or inactive"}, status=404)
        except Exception as e:
            logger.error(f"Purchase error: {str(e)}")
            return Response({"error": "Server error processing transaction"}, status=500)


class StripeWebhookView(APIView):
    """Handle Stripe webhook events, specifically for processing completed checkout sessions."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Process Stripe webhook payloads and update user payment status."""
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")

        webhook_secret = settings.STRIPE_WEBHOOK_SECRET
        if not webhook_secret:
            logger.error("STRIPE_WEBHOOK_SECRET is not configured.")
            return HttpResponse(status=500)

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            logger.info("Stripe webhook received", extra={"event_type": event.get("type")})

            record_funnel_event(
                "webhook_received",
                user=request.user if request.user.is_authenticated else None,
                metadata={"event_type": event.get("type")},
            )

            if event["type"] == "checkout.session.completed":
                session = event["data"]["object"]
                metadata = session.get("metadata", {}) or {}
                plan_id = normalize_plan_id(metadata.get("plan_id")) if metadata else None
                if plan_id not in {"starter", "plus", "pro"}:
                    plan_id = "plus"
                user_id_raw = session.get("client_reference_id")
                if not user_id_raw:
                    logger.warning(
                        "Stripe webhook: checkout.session.completed missing client_reference_id"
                    )
                else:
                    try:
                        user_id = int(user_id_raw)
                    except (TypeError, ValueError):
                        logger.warning(
                            "Stripe webhook: invalid client_reference_id %s",
                            user_id_raw,
                        )
                        user_id = None
                    if user_id is not None:
                        User = get_user_model()
                        try:
                            user = User.objects.get(id=user_id)
                        except User.DoesNotExist:
                            logger.warning(
                                "Stripe webhook: User id=%s does not exist, skipping",
                                user_id,
                            )
                        else:
                            payment_status = session.get("payment_status", "")
                            session_status = session.get("status", "")
                            subscription_status = (
                                "active"
                                if payment_status == "paid"
                                else (payment_status or session_status or "completed")
                            )
                            trial_end_dt = None
                            sub_id = session.get("subscription")
                            customer_id_webhook = None
                            if sub_id:
                                try:
                                    sub = stripe.Subscription.retrieve(sub_id)
                                    subscription_status = sub.status  # trialing or active
                                    if getattr(sub, "trial_end", None):
                                        trial_end_dt = timezone.make_aware(
                                            datetime.utcfromtimestamp(sub.trial_end),
                                            timezone.utc,
                                        )
                                    customer_id_webhook = (
                                        sub.customer
                                        if isinstance(sub.customer, str)
                                        else getattr(sub.customer, "id", None)
                                    )
                                except stripe.error.StripeError as e:
                                    logger.warning(
                                        "Stripe webhook: could not retrieve subscription %s: %s",
                                        sub_id,
                                        e,
                                    )
                            with transaction.atomic():
                                (
                                    user_profile,
                                    _,
                                ) = UserProfile.objects.select_for_update().get_or_create(
                                    user_id=user_id,
                                    defaults={
                                        "has_paid": False,
                                        "is_premium": False,
                                        "subscription_status": "inactive",
                                        "stripe_payment_id": "",
                                        "subscription_plan_id": plan_id or "plus",
                                    },
                                )
                                if not user_profile.has_paid:
                                    user_profile.has_paid = True
                                user_profile.is_premium = True
                                user_profile.subscription_status = subscription_status
                                user_profile.stripe_payment_id = (
                                    session.get("payment_intent", "") or ""
                                )
                                if plan_id:
                                    user_profile.subscription_plan_id = plan_id
                                if trial_end_dt is not None:
                                    user_profile.trial_end = trial_end_dt
                                if sub_id:
                                    user_profile.stripe_subscription_id = sub_id
                                if customer_id_webhook:
                                    user_profile.stripe_customer_id = customer_id_webhook
                                update_fields = [
                                    "has_paid",
                                    "is_premium",
                                    "subscription_status",
                                    "stripe_payment_id",
                                    "subscription_plan_id",
                                ]
                                if trial_end_dt is not None:
                                    update_fields.append("trial_end")
                                if sub_id:
                                    update_fields.append("stripe_subscription_id")
                                if customer_id_webhook:
                                    update_fields.append("stripe_customer_id")
                                user_profile.save(update_fields=update_fields)
                                cache.delete_many(
                                    [
                                        f"user_payment_status_{user_id}",
                                        f"user_profile_{user_id}",
                                    ]
                                )

            elif event["type"] in {
                "checkout.session.expired",
                "checkout.session.async_payment_failed",
            }:
                session = event["data"]["object"]
                user_id_raw = session.get("client_reference_id")
                if user_id_raw:
                    try:
                        user_id = int(user_id_raw)
                    except (TypeError, ValueError):
                        user_id = None
                    else:
                        session_status = session.get("status", "expired")
                        with transaction.atomic():
                            user_profile = (
                                UserProfile.objects.select_for_update()
                                .filter(user_id=user_id)
                                .first()
                            )
                            if user_profile:
                                user_profile.subscription_status = session_status
                                user_profile.stripe_payment_id = (
                                    session.get("payment_intent", "") or ""
                                )
                                user_profile.save(
                                    update_fields=[
                                        "subscription_status",
                                        "stripe_payment_id",
                                    ]
                                )
                                cache.delete_many(
                                    [
                                        f"user_payment_status_{user_id}",
                                        f"user_profile_{user_id}",
                                    ]
                                )
                                record_funnel_event(
                                    "checkout_completed",
                                    user=user_profile.user,
                                    session_id=session.get("id", ""),
                                    metadata={
                                        "payment_intent": session.get("payment_intent", ""),
                                        "amount_total": session.get("amount_total"),
                                        "currency": session.get("currency"),
                                    },
                                )

            elif event["type"] == "customer.subscription.updated":
                sub = event["data"]["object"]
                sub_id = sub.get("id")
                status = sub.get("status")
                if not sub_id:
                    pass
                elif status == "active":
                    with transaction.atomic():
                        profile = (
                            UserProfile.objects.select_for_update()
                            .filter(stripe_subscription_id=sub_id)
                            .first()
                        )
                        if profile:
                            profile.subscription_status = "active"
                            profile.trial_end = None
                            profile.save(update_fields=["subscription_status", "trial_end"])
                            cache.delete_many(
                                [
                                    f"user_payment_status_{profile.user_id}",
                                    f"user_profile_{profile.user_id}",
                                ]
                            )
                elif status == "canceled":
                    with transaction.atomic():
                        profile = (
                            UserProfile.objects.select_for_update()
                            .filter(stripe_subscription_id=sub_id)
                            .first()
                        )
                        if profile:
                            profile.is_premium = False
                            profile.subscription_plan_id = "starter"
                            profile.stripe_subscription_id = None
                            profile.subscription_status = "canceled"
                            profile.trial_end = None
                            profile.save(
                                update_fields=[
                                    "is_premium",
                                    "subscription_plan_id",
                                    "stripe_subscription_id",
                                    "subscription_status",
                                    "trial_end",
                                ]
                            )
                            cache.delete_many(
                                [
                                    f"user_payment_status_{profile.user_id}",
                                    f"user_profile_{profile.user_id}",
                                ]
                            )

            elif event["type"] == "customer.subscription.deleted":
                sub = event["data"]["object"]
                sub_id = sub.get("id")
                if sub_id:
                    with transaction.atomic():
                        profile = (
                            UserProfile.objects.select_for_update()
                            .filter(stripe_subscription_id=sub_id)
                            .first()
                        )
                        if profile:
                            profile.is_premium = False
                            profile.subscription_plan_id = "starter"
                            profile.stripe_subscription_id = None
                            profile.subscription_status = "canceled"
                            profile.trial_end = None
                            profile.save(
                                update_fields=[
                                    "is_premium",
                                    "subscription_plan_id",
                                    "stripe_subscription_id",
                                    "subscription_status",
                                    "trial_end",
                                ]
                            )
                            cache.delete_many(
                                [
                                    f"user_payment_status_{profile.user_id}",
                                    f"user_profile_{profile.user_id}",
                                ]
                            )

        except stripe.error.SignatureVerificationError as exc:
            logger.warning("Stripe signature verification failed: %s", exc)
            return HttpResponse(status=400)
        except Exception as e:
            logger.error(f"Webhook error: {str(e)}")
            record_funnel_event(
                "webhook_received",
                status="error",
                user=request.user if request.user.is_authenticated else None,
                metadata={"error": str(e)},
            )

        return HttpResponse(status=200)


class VerifySessionView(APIView):
    """Verify the payment status of a Stripe checkout session."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Check the payment status of a session and update the user's profile if paid."""
        try:
            session_id = request.data.get("session_id")
            if not session_id or not session_id.startswith("cs_"):
                return Response({"error": "Invalid session ID format"}, status=400)

            stripe.api_key = settings.STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(
                session_id, expand=["payment_intent", "subscription"]
            )

            # For subscription mode, accept when session is complete (trial = unpaid until trial ends)
            session_complete = getattr(session, "status", None) == "complete"
            payment_paid = getattr(session, "payment_status", None) == "paid"
            if session.mode == "subscription":
                if not session_complete:
                    return Response({"status": "pending"}, status=202)
            elif not payment_paid:
                return Response({"status": "pending"}, status=202)

            metadata = getattr(session, "metadata", {}) or {}
            plan_id = normalize_plan_id(metadata.get("plan_id")) if metadata else None
            if plan_id not in {"starter", "plus", "pro"}:
                plan_id = "plus"
            target_user_id = session.client_reference_id or metadata.get("user_id")

            if request.user and request.user.is_authenticated:
                user_id_int = request.user.id
            elif target_user_id:
                try:
                    user_id_int = int(target_user_id)
                except (TypeError, ValueError):
                    return Response({"error": "Invalid user context"}, status=400)
            else:
                return Response({"error": "Missing user context for session"}, status=400)

            User = get_user_model()
            try:
                stripe_payment_id = getattr(getattr(session, "payment_intent", None), "id", "")
                sub_id = None
                subscription_status = "active"
                trial_end_dt = None
                customer_id_from_sub = None
                if getattr(session, "subscription", None):
                    sub = session.subscription
                    sub_id = sub if isinstance(sub, str) else getattr(sub, "id", None)
                    if sub_id and not isinstance(sub, str):
                        subscription_status = getattr(sub, "status", "active") or "active"
                        te = getattr(sub, "trial_end", None)
                        if te:
                            trial_end_dt = datetime.fromtimestamp(te, tz=timezone.utc)
                        customer_id_from_sub = (
                            sub.customer
                            if isinstance(sub.customer, str)
                            else getattr(sub, "customer", None)
                        )
                        if customer_id_from_sub and not isinstance(customer_id_from_sub, str):
                            customer_id_from_sub = getattr(customer_id_from_sub, "id", None)
                    elif sub_id:
                        sub_obj = stripe.Subscription.retrieve(sub_id)
                        subscription_status = getattr(sub_obj, "status", "active") or "active"
                        te = getattr(sub_obj, "trial_end", None)
                        if te:
                            trial_end_dt = datetime.fromtimestamp(te, tz=timezone.utc)
                        customer_id_from_sub = (
                            sub_obj.customer
                            if isinstance(sub_obj.customer, str)
                            else getattr(sub_obj.customer, "id", None)
                        )

                with transaction.atomic():
                    profile, _ = UserProfile.objects.select_for_update().get_or_create(
                        user_id=user_id_int,
                        defaults={
                            "has_paid": True,
                            "is_premium": True,
                            "subscription_status": subscription_status,
                            "stripe_payment_id": stripe_payment_id,
                            "subscription_plan_id": plan_id or "plus",
                        },
                    )

                    profile.has_paid = True
                    profile.is_premium = True
                    profile.subscription_status = subscription_status
                    profile.stripe_payment_id = stripe_payment_id
                    if plan_id:
                        profile.subscription_plan_id = plan_id
                    if sub_id:
                        profile.stripe_subscription_id = sub_id
                    if customer_id_from_sub:
                        profile.stripe_customer_id = customer_id_from_sub
                    if trial_end_dt is not None:
                        profile.trial_end = trial_end_dt
                    update_fields = [
                        "has_paid",
                        "is_premium",
                        "subscription_status",
                        "stripe_payment_id",
                        "subscription_plan_id",
                    ]
                    if sub_id:
                        update_fields.append("stripe_subscription_id")
                    if customer_id_from_sub:
                        update_fields.append("stripe_customer_id")
                    if trial_end_dt is not None:
                        update_fields.append("trial_end")
                    profile.save(update_fields=update_fields)

                    cache.delete_many(
                        [
                            f"user_payment_status_{user_id_int}",
                            f"user_profile_{user_id_int}",
                        ]
                    )
                    cache.set(f"user_payment_status_{user_id_int}", "paid", 300)

                try:
                    user_for_event = User.objects.get(id=user_id_int)
                except User.DoesNotExist:
                    user_for_event = None

                event_metadata = {
                    "payment_intent": str(getattr(session, "payment_intent", "") or ""),
                    "amount_total": getattr(session, "amount_total", None),
                    "currency": getattr(session, "currency", None),
                }
                try:
                    json.dumps(event_metadata)
                except TypeError:
                    event_metadata = {}

                record_funnel_event(
                    "checkout_verified",
                    user=user_for_event,
                    session_id=str(getattr(session, "id", "") or ""),
                    metadata=event_metadata,
                )
            except UserProfile.DoesNotExist:
                logger.warning("No profile found for verified session %s", session_id)
                return Response({"error": "Profile not found"}, status=404)

            return Response({"status": "verified"})
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            return Response({"error": "Payment verification failed"}, status=400)
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return Response({"error": "Server error"}, status=500)


class SubscriptionCreateView(APIView):
    """Create a Stripe checkout session for a plan (for users who already completed questionnaire)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get("plan_id")
        billing_interval = request.data.get("billing_interval", "monthly")
        if not plan_id:
            return Response({"error": "plan_id is required"}, status=400)
        if plan_id == "starter" or plan_id == "free":
            return Response(
                {
                    "error": "Starter plan does not require checkout. Use the free option on the plans page."
                },
                status=400,
            )
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not stripe_key:
            logger.error("STRIPE_SECRET_KEY is not configured.")
            return Response(
                {"error": "Payment is not configured. Please try again later."},
                status=503,
            )
        # Resolve Stripe price by plan and billing interval (yearly first; trial only on yearly)
        price_id = None
        if billing_interval == "yearly":
            if plan_id == "plus":
                price_id = getattr(settings, "STRIPE_PRICE_PLUS_YEARLY", None)
            elif plan_id == "pro":
                price_id = getattr(settings, "STRIPE_PRICE_PRO_YEARLY", None)
        else:
            if plan_id == "plus":
                price_id = getattr(settings, "STRIPE_PRICE_PLUS_MONTHLY", None)
            elif plan_id == "pro":
                price_id = getattr(settings, "STRIPE_PRICE_PRO_MONTHLY", None)
        if not price_id:
            price_id = (
                getattr(settings, "STRIPE_DEFAULT_PRICE_ID", None)
                or getattr(settings, "STRIPE_PRICE_PLUS_YEARLY", None)
                or getattr(settings, "STRIPE_PRICE_PLUS_MONTHLY", None)
            )
        if not price_id:
            logger.error("No Stripe price configured for plan_id=%s", plan_id)
            return Response(
                {
                    "error": "This plan is not configured for checkout. Please try another plan or contact support."
                },
                status=503,
            )
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        promotion_code_raw = request.data.get("promotion_code") or getattr(
            settings, "STRIPE_DEFAULT_PROMOTION_CODE", None
        )
        promotion_code_id = None
        if promotion_code_raw:
            promotion_code_raw = promotion_code_raw.strip()
            if promotion_code_raw.startswith("promo_"):
                promotion_code_id = promotion_code_raw
            else:
                try:
                    stripe.api_key = stripe_key
                    promos = stripe.PromotionCode.list(
                        code=promotion_code_raw,
                        active=True,
                        limit=1,
                    )
                    if promos.data:
                        promotion_code_id = promos.data[0].id
                    else:
                        logger.warning(
                            "Stripe promotion code not found or inactive: %s",
                            promotion_code_raw[:8] + "...",
                        )
                except stripe.error.StripeError as e:
                    logger.warning("Stripe error resolving promotion code: %s", e)
        # 7-day free trial only on yearly Pro/Plus; day 7 = charge full yearly amount
        trial_days = 7 if billing_interval == "yearly" and plan_id in ("plus", "pro") else 0
        create_params = {
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": (f"{frontend_url}/payment-success?" "session_id={CHECKOUT_SESSION_ID}"),
            "cancel_url": f"{frontend_url}/subscriptions",
            "metadata": {"user_id": str(request.user.id), "plan_id": plan_id},
            "client_reference_id": str(request.user.id),
        }
        if getattr(request.user, "email", None):
            create_params["customer_email"] = request.user.email
        if trial_days:
            create_params["subscription_data"] = {"trial_period_days": trial_days}
        # Stripe allows only one of allow_promotion_codes or discounts per session
        if promotion_code_id:
            create_params["discounts"] = [{"promotion_code": promotion_code_id}]
        else:
            create_params["allow_promotion_codes"] = True
        try:
            stripe.api_key = stripe_key
            checkout_session = stripe.checkout.Session.create(**create_params)
            record_funnel_event(
                "checkout_created",
                user=request.user,
                session_id=getattr(checkout_session, "id", ""),
                metadata={
                    "plan_id": plan_id,
                    "billing_interval": billing_interval,
                },
            )
            return Response(
                {"success": True, "redirect_url": checkout_session.url},
                status=200,
            )
        except stripe.error.StripeError as e:
            logger.error("Stripe error creating checkout: %s", e)
            return Response(
                {"error": "Payment processing failed. Please try again."},
                status=400,
            )
        except Exception as e:
            logger.error("Subscription create error: %s", e, exc_info=True)
            return Response(
                {"error": "Server error. Please try again later."},
                status=500,
            )


def _get_or_resolve_stripe_subscription_id(profile):
    """
    Return profile.stripe_subscription_id if set. Otherwise, for premium users,
    try to resolve by stripe_customer_id, then by customer email, and save on the profile.
    """
    sub_id = (getattr(profile, "stripe_subscription_id", None) or "").strip()
    if sub_id:
        return sub_id
    cid = (getattr(profile, "stripe_customer_id", None) or "").strip()
    if cid:
        try:
            for sub in stripe.Subscription.list(customer=cid, status="all", limit=10).data:
                if getattr(sub, "status", None) in ("active", "trialing"):
                    found_id = sub.id if isinstance(sub, str) else getattr(sub, "id", None)
                    if found_id:
                        profile.stripe_subscription_id = found_id
                        profile.save(update_fields=["stripe_subscription_id"])
                        cache.delete_many(
                            [
                                f"user_payment_status_{profile.user_id}",
                                f"user_profile_{profile.user_id}",
                            ]
                        )
                        invalidate_profile_cache(profile.user)
                        return found_id
        except stripe.error.StripeError as e:
            logger.warning(
                "Stripe resolve: error listing subscriptions by customer_id=%s for user_profile=%s: %s",
                cid,
                getattr(profile, "id", None),
                e,
            )
    if not getattr(profile.user, "email", None):
        return None
    is_premium = getattr(profile, "is_premium", False) or getattr(profile, "has_paid", False)
    status_ok = getattr(profile, "subscription_status", None) in ("active", "trialing")
    if not (is_premium or status_ok):
        return None
    email = (profile.user.email or "").strip()
    emails_to_try = [email] if email else []
    if email and email.lower() != email:
        emails_to_try.append(email.lower())
    for try_email in emails_to_try:
        if not try_email:
            continue
        try:
            customers = stripe.Customer.list(email=try_email, limit=5)
            for cust in customers.data:
                cid = cust.id if isinstance(cust, str) else getattr(cust, "id", None)
                if not cid:
                    continue
                # Persist customer id so portal can work without subscription lookup next time
                update_fields = []
                if not (getattr(profile, "stripe_customer_id", None) or "").strip():
                    profile.stripe_customer_id = cid
                    update_fields.append("stripe_customer_id")
                subs = stripe.Subscription.list(customer=cid, status="all", limit=10)
                for sub in subs.data:
                    if getattr(sub, "status", None) in ("active", "trialing"):
                        found_id = sub.id if isinstance(sub, str) else getattr(sub, "id", None)
                        if found_id:
                            profile.stripe_subscription_id = found_id
                            update_fields.append("stripe_subscription_id")
                            profile.save(update_fields=update_fields)
                            cache.delete_many(
                                [
                                    f"user_payment_status_{profile.user_id}",
                                    f"user_profile_{profile.user_id}",
                                ]
                            )
                            invalidate_profile_cache(profile.user)
                            logger.info(
                                "Resolved stripe_subscription_id for user %s by email lookup",
                                profile.user_id,
                            )
                            return found_id
                if update_fields:
                    profile.save(update_fields=update_fields)
                    cache.delete_many(
                        [
                            f"user_payment_status_{profile.user_id}",
                            f"user_profile_{profile.user_id}",
                        ]
                    )
                    invalidate_profile_cache(profile.user)
        except stripe.error.StripeError as e:
            logger.warning("Stripe lookup by email %s failed: %s", try_email[:8], e)
    if email:
        logger.info(
            "No Stripe subscription found for user %s email %s (customer may use different email in Stripe)",
            profile.user_id,
            email[:8] + "...",
        )
    return None


class SubscriptionSyncView(APIView):
    """
    Try to resolve and save stripe_subscription_id for the current user (e.g. by email lookup).
    Call this when loading the billing page so cancel/portal work even if verify-session wasn't run.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not stripe_key:
            return Response(
                {"ok": False, "error": "Payment is not configured."},
                status=503,
            )
        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            return Response(
                {"ok": False, "error": "Profile not found."},
                status=404,
            )
        stripe.api_key = stripe_key
        sub_id = _get_or_resolve_stripe_subscription_id(profile)
        if sub_id:
            return Response({"ok": True}, status=200)
        if getattr(profile, "is_premium", False) or getattr(profile, "has_paid", False):
            return Response(
                {
                    "ok": False,
                    "error": "We couldn't find your subscription in Stripe. If you subscribed with a different email, contact support.",
                },
                status=200,
            )
        return Response({"ok": False, "error": "No active subscription."}, status=200)


class SubscriptionPortalView(APIView):
    """Create a Stripe Customer Portal session so the user can manage or cancel their subscription."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not stripe_key:
            logger.error("STRIPE_SECRET_KEY is not configured.")
            return Response(
                {"error": "Payment is not configured. Please try again later."},
                status=503,
            )
        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            return Response(
                {"error": "Profile not found."},
                status=404,
            )
        stripe.api_key = stripe_key
        customer_id = (getattr(profile, "stripe_customer_id", None) or "").strip()
        if not customer_id:
            sub_id = _get_or_resolve_stripe_subscription_id(profile)
            if sub_id:
                try:
                    sub = stripe.Subscription.retrieve(sub_id)
                    customer_id = (
                        sub.customer
                        if isinstance(sub.customer, str)
                        else getattr(sub.customer, "id", None)
                    )
                    if customer_id:
                        profile.stripe_customer_id = customer_id
                        profile.save(update_fields=["stripe_customer_id"])
                except stripe.error.StripeError as e:
                    logger.warning(
                        "Portal: error retrieving subscription %s for user_profile=%s: %s",
                        sub_id,
                        getattr(profile, "id", None),
                        e,
                    )
        if not customer_id:
            return Response(
                {
                    "error": "No active subscription found. If you have a subscription, refresh the page to sync, or contact support.",
                },
                status=400,
            )
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        return_url = f"{frontend_url.rstrip('/')}/subscriptions"
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return Response({"url": session.url}, status=200)
        except stripe.error.StripeError as e:
            logger.error("Stripe portal error: %s", e)
            return Response(
                {"error": "Could not open customer portal. Please try again or contact support."},
                status=400,
            )
        except Exception as e:
            logger.error("Subscription portal error: %s", e, exc_info=True)
            return Response(
                {"error": "Server error. Please try again later."},
                status=500,
            )


class SubscriptionCancelView(APIView):
    """Cancel the user's active Stripe subscription at period end."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not stripe_key:
            logger.error("STRIPE_SECRET_KEY is not configured.")
            return Response(
                {"error": "Payment is not configured. Please try again later."},
                status=503,
            )
        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            return Response({"error": "Profile not found."}, status=404)

        stripe.api_key = stripe_key
        sub_id = _get_or_resolve_stripe_subscription_id(profile)
        if not sub_id:
            cid = (getattr(profile, "stripe_customer_id", None) or "").strip()
            if cid:
                try:
                    for sub in stripe.Subscription.list(customer=cid, status="all", limit=10).data:
                        if getattr(sub, "status", None) in ("active", "trialing"):
                            sub_id = sub.id if isinstance(sub, str) else getattr(sub, "id", None)
                            if sub_id:
                                profile.stripe_subscription_id = sub_id
                                profile.save(update_fields=["stripe_subscription_id"])
                                cache.delete_many(
                                    [
                                        f"user_payment_status_{profile.user_id}",
                                        f"user_profile_{profile.user_id}",
                                    ]
                                )
                                invalidate_profile_cache(profile.user)
                                break
                except stripe.error.StripeError as e:
                    logger.warning(
                        "Cancel: error listing subscriptions for customer_id=%s and user_profile=%s: %s",
                        cid,
                        getattr(profile, "id", None),
                        e,
                    )
        if not sub_id:
            return Response(
                {
                    "error": "No active subscription found. If you have a subscription, refresh the page to sync, or contact support.",
                },
                status=400,
            )

        try:
            # Set cancel_at_period_end instead of immediate cancellation
            subscription = stripe.Subscription.modify(
                sub_id,
                cancel_at_period_end=True,
            )
            profile.subscription_status = getattr(subscription, "status", "canceled")
            profile.save(update_fields=["subscription_status"])
            cancel_at_period_end = getattr(subscription, "cancel_at_period_end", True)
            current_period_end = getattr(subscription, "current_period_end", None)
            period_end_iso = None
            if current_period_end:
                period_end_iso = datetime.fromtimestamp(
                    current_period_end, tz=timezone.utc
                ).isoformat()
            if request.user.email:
                send_subscription_cancelled_email.delay(
                    email=request.user.email,
                    display_name=normalize_display_string(
                        request.user.first_name or request.user.username or "there"
                    ),
                    access_until_iso=period_end_iso,
                )
            return Response(
                {
                    "success": True,
                    "cancel_at_period_end": cancel_at_period_end,
                    "current_period_end": period_end_iso,
                },
                status=200,
            )
        except stripe.error.StripeError as e:
            logger.error("Stripe cancel error: %s", e)
            return Response(
                {"error": "Failed to cancel subscription. Please try again."},
                status=400,
            )
        except Exception as e:
            logger.error("Subscription cancel error: %s", e, exc_info=True)
            return Response(
                {"error": "Server error. Please try again later."},
                status=500,
            )


class EntitlementStatusView(APIView):
    """Expose entitlement information for authenticated users."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = UserProfile.objects.get(user=request.user)
            plan = get_user_plan(request.user)
            entitlements = get_entitlements_for_user(request.user)
            trial_end = getattr(profile, "trial_end", None)
            subscription = {
                "is_premium": bool(getattr(profile, "is_premium", False)),
                "status": getattr(profile, "subscription_status", "inactive"),
                "has_paid": bool(profile.has_paid),
                "plan_id": plan,
                "trial_end": trial_end.isoformat() if trial_end else None,
            }
            payload = {
                "entitled": plan != "starter",
                "plan": plan,
                "label": entitlements.get("label"),
                "features": entitlements.get("features", {}),
                "subscription": subscription,
                "checked_at": timezone.now(),
            }
            record_funnel_event(
                "entitlement_lookup",
                user=request.user,
                status="success",
                metadata={"plan": plan},
            )
            return Response(payload)
        except Exception as exc:
            logger.error("Failed to fetch entitlements for user %s: %s", request.user.id, exc)
            record_funnel_event(
                "entitlement_lookup",
                user=request.user,
                status="error",
                metadata={"error": str(exc)},
            )
            return Response({"error": "Unable to verify entitlements right now."}, status=503)


class FunnelEventIngestView(APIView):
    """Allow clients to log funnel events such as pricing page views."""

    permission_classes = [AllowAny]

    ALLOWED_EVENT_TYPES = {
        "pricing_view",
        "checkout_created",
        "checkout_completed",
        "entitlement_lookup",
        "webhook_received",
        # Dashboard analytics events
        "dashboard_view",
        "cta_click",
        "weak_skill_click",
        "sort_change",
        "filter_change",
        "improve_recommendation_click",
        "upgrade_click",
        # Onboarding questionnaire events
        "questionnaire_step_view",
        "questionnaire_answer_submitted",
        "questionnaire_abandoned",
        "questionnaire_completed",
    }

    def post(self, request):
        FunnelEvent = apps.get_model("finance", "FunnelEvent")
        if FunnelEvent is None:
            return Response(
                {"error": "FunnelEvent model unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        event_type = request.data.get("event_type")
        status = request.data.get("status", "success")
        session_id = request.data.get("session_id", "")
        metadata = request.data.get("metadata", {}) or {}

        if event_type not in self.ALLOWED_EVENT_TYPES:
            return Response({"error": "Unsupported event type"}, status=400)

        record_funnel_event(
            event_type,
            status=status,
            user=request.user if request.user.is_authenticated else None,
            session_id=session_id,
            metadata=metadata,
        )

        logger.info(
            "Funnel event recorded",
            extra={"event_type": event_type, "status": status},
        )

        return Response({"ok": True})


class FunnelMetricsView(APIView):
    """Summarise funnel performance for administrators."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=403)

        FunnelEvent = apps.get_model("finance", "FunnelEvent")
        if FunnelEvent is None:
            return Response(
                {"error": "FunnelEvent model unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        events = FunnelEvent.objects.filter(created_at__gte=since)

        def count(event_type, status=None):
            queryset = events.filter(event_type=event_type)
            if status:
                queryset = queryset.filter(status=status)
            return queryset.count()

        pricing_views = count("pricing_view")
        checkouts_created = count("checkout_created")
        checkouts_completed = count("checkout_completed")
        entitlement_success = count("entitlement_lookup", status="success")
        entitlement_failures = count("entitlement_lookup", status="error")

        daily = (
            events.annotate(day=TruncDate("created_at"))
            .values("event_type", "day")
            .annotate(total=Count("id"))
            .order_by("day")
        )

        def rate(numerator, denominator):
            return round((numerator / denominator) * 100, 2) if denominator else 0.0

        return Response(
            {
                "summary": {
                    "pricing_views": pricing_views,
                    "checkouts_created": checkouts_created,
                    "checkouts_completed": checkouts_completed,
                    "entitlement_success": entitlement_success,
                    "entitlement_failures": entitlement_failures,
                    "pricing_to_checkout_rate": rate(checkouts_created, pricing_views),
                    "checkout_to_paid_rate": rate(checkouts_completed, checkouts_created),
                    "entitlement_success_rate": rate(
                        entitlement_success, entitlement_success + entitlement_failures
                    ),
                },
                "daily_breakdown": list(daily),
            }
        )


class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PortfolioEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        portfolio = self.get_queryset()
        total_value = sum(entry.calculate_value() for entry in portfolio)
        total_gain_loss = sum(entry.calculate_gain_loss() for entry in portfolio)

        # Calculate allocation by asset type
        allocation = {}
        for entry in portfolio:
            value = entry.calculate_value()
            if entry.asset_type not in allocation:
                allocation[entry.asset_type] = 0
            allocation[entry.asset_type] += value

        return Response(
            {
                "total_value": total_value,
                "total_gain_loss": total_gain_loss,
                "allocation": allocation,
            }
        )


class FinancialGoalViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FinancialGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def add_funds(self, request, pk=None):
        goal = self.get_object()
        amount = Decimal(request.data.get("amount", 0))

        if amount <= 0:
            return Response(
                {"error": "Amount must be greater than 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        goal.current_amount += amount
        goal.save()

        # Check if goal is completed
        if goal.current_amount >= goal.target_amount:
            # Award points for completing a goal
            user_profile = request.user.profile
            user_profile.add_points(100)
            user_profile.save()

        return Response(self.get_serializer(goal).data)


class NewsFeedView(APIView):
    """Return a cached, curated finance news feed with context.
    Uses multiple RSS sources; on total failure serves last-known-good cache (stale).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get(NEWS_CACHE_KEY)
        if cached:
            return Response(cached)

        all_items = []
        timeout = NEWS_FEED_TIMEOUT_SECONDS
        for feed in NEWS_FEEDS:
            try:
                response = requests.get(feed["url"], timeout=timeout)
                response.raise_for_status()
                feed_items = _parse_rss_items(response.text, feed["name"])
                # Cap per source so one feed doesn't dominate (newest 4 per source)
                feed_items_sorted = sorted(
                    feed_items, key=lambda x: x.get("published_at") or "", reverse=True
                )
                all_items.extend(feed_items_sorted[:4])
            except Exception as exc:
                logger.warning("Failed to fetch feed %s: %s", feed["url"], exc)
                continue

        # Deduplicate by URL (keep first = most recent when sorted)
        seen_urls = set()
        unique = []
        for item in sorted(all_items, key=lambda x: x.get("published_at") or "", reverse=True):
            url = (item.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            unique.append(item)

        items = unique[:12]

        generated_at = timezone.now().isoformat()
        payload = {
            "items": items,
            "generated_at": generated_at,
            "stale": False,
            "sources": [feed["name"] for feed in NEWS_FEEDS],
        }
        if items:
            cache.set(NEWS_CACHE_KEY, payload, timeout=NEWS_CACHE_TTL_SECONDS)
            cache.set(NEWS_LAST_GOOD_CACHE_KEY, payload, timeout=7 * 24 * 60 * 60)
            return Response(payload)

        last_good = cache.get(NEWS_LAST_GOOD_CACHE_KEY)
        if last_good:
            last_good["stale"] = True
            return Response(last_good)

        # RSS ingestion failure: all feeds failed and no stale cache (Sentry disabled)
        # if getattr(settings, "SENTRY_DSN", None):
        #     import sentry_sdk
        #     sentry_sdk.capture_message(
        #         "News feed: all RSS sources failed, no last-good cache",
        #         level="warning",
        #     )
        return Response(
            {
                "items": [],
                "generated_at": generated_at,
                "stale": False,
                "sources": [feed["name"] for feed in NEWS_FEEDS],
            }
        )
