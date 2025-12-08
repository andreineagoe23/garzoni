# finance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SavingsAccountView,
    FinanceFactView,
    SavingsGoalCalculatorView,
    RewardViewSet,
    UserPurchaseViewSet,
    StripeWebhookView,
    VerifySessionView,
    PortfolioViewSet,
    FinancialGoalViewSet,
    StockPriceView,
    ForexRateView,
    CryptoPriceView,
)

router = DefaultRouter()
router.register(r'portfolio', PortfolioViewSet, basename='portfolio')
router.register(r'financial-goals', FinancialGoalViewSet, basename='financial-goals')

urlpatterns = [
    path('', include(router.urls)),
    path('savings-account/', SavingsAccountView.as_view(), name='savings-account'),
    path('finance-fact/', FinanceFactView.as_view(), name='finance-fact'),
    path('calculate-savings-goal/', SavingsGoalCalculatorView.as_view(), name='calculate_savings_goal'),
    path('rewards/shop/', RewardViewSet.as_view({'get': 'list'}), name='shop-rewards'),
    path('rewards/donate/', RewardViewSet.as_view({'get': 'list'}), name='donate-rewards'),
    path('purchases/', UserPurchaseViewSet.as_view({'post': 'create'}), name='purchases-create'),
    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('verify-session/', VerifySessionView.as_view(), name='verify-session'),
    path('stock-price/', StockPriceView.as_view(), name='stock-price'),
    path('forex-rate/', ForexRateView.as_view(), name='forex-rate'),
    path('crypto-price/', CryptoPriceView.as_view(), name='crypto-price'),
]

