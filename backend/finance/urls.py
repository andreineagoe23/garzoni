# finance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .mobile_tools_api import (
    EconomicCalendarMobileView,
    NextStepCompleteMobileView,
    NextStepsMobileView,
)
from .views import (
    SavingsAccountView,
    FinanceFactView,
    SavingsGoalCalculatorView,
    RewardViewSet,
    UserPurchaseViewSet,
    StripeWebhookView,
    VerifySessionView,
    SubscriptionCreateView,
    SubscriptionChangeView,
    SubscriptionSyncView,
    SubscriptionPortalView,
    SubscriptionCancelView,
    PortfolioViewSet,
    FinancialGoalViewSet,
    StockPriceView,
    ForexRateView,
    CryptoPriceView,
    EntitlementStatusView,
    FunnelEventIngestView,
    FunnelMetricsView,
    NewsFeedView,
)

router = DefaultRouter()
router.register(r"portfolio", PortfolioViewSet, basename="portfolio")
router.register(r"financial-goals", FinancialGoalViewSet, basename="financial-goals")

urlpatterns = [
    path(
        "economic-calendar/",
        EconomicCalendarMobileView.as_view(),
        name="economic-calendar-mobile",
    ),
    path("next-steps/", NextStepsMobileView.as_view(), name="next-steps-mobile"),
    path(
        "next-steps/<str:step_id>/complete/",
        NextStepCompleteMobileView.as_view(),
        name="next-step-complete-mobile",
    ),
    path("", include(router.urls)),
    # Compatibility prefix for clients hitting /api/finance/entitlements/
    path(
        "finance/entitlements/",
        EntitlementStatusView.as_view(),
        name="entitlements-compat",
    ),
    # Compatibility prefix for clients hitting /api/finance/news/
    path("finance/news/", NewsFeedView.as_view(), name="news-feed-compat"),
    path("savings-account/", SavingsAccountView.as_view(), name="savings-account"),
    path("finance-fact/", FinanceFactView.as_view(), name="finance-fact"),
    path(
        "calculate-savings-goal/",
        SavingsGoalCalculatorView.as_view(),
        name="calculate_savings_goal",
    ),
    path("rewards/shop/", RewardViewSet.as_view({"get": "list"}), name="shop-rewards"),
    path("rewards/donate/", RewardViewSet.as_view({"get": "list"}), name="donate-rewards"),
    path(
        "purchases/",
        UserPurchaseViewSet.as_view({"post": "create"}),
        name="purchases-create",
    ),
    path("stripe-webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("verify-session/", VerifySessionView.as_view(), name="verify-session"),
    path(
        "subscriptions/create/",
        SubscriptionCreateView.as_view(),
        name="subscriptions-create",
    ),
    path(
        "subscriptions/change/",
        SubscriptionChangeView.as_view(),
        name="subscriptions-change",
    ),
    path(
        "subscriptions/sync/",
        SubscriptionSyncView.as_view(),
        name="subscriptions-sync",
    ),
    path(
        "subscriptions/cancel/",
        SubscriptionCancelView.as_view(),
        name="subscriptions-cancel",
    ),
    path(
        "subscriptions/portal/",
        SubscriptionPortalView.as_view(),
        name="subscriptions-portal",
    ),
    path("entitlements/", EntitlementStatusView.as_view(), name="entitlements"),
    path("funnel/events/", FunnelEventIngestView.as_view(), name="funnel-events"),
    path("funnel/metrics/", FunnelMetricsView.as_view(), name="funnel-metrics"),
    path("stock-price/", StockPriceView.as_view(), name="stock-price"),
    path("forex-rate/", ForexRateView.as_view(), name="forex-rate"),
    path("crypto-price/", CryptoPriceView.as_view(), name="crypto-price"),
    path("news/", NewsFeedView.as_view(), name="news-feed"),
]
