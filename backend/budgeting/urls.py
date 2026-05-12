from django.urls import include, path
from rest_framework.routers import DefaultRouter

from budgeting.views import (
    BudgetEnvelopeViewSet,
    LinkedAccountViewSet,
    PersonalCfoCoachView,
    PersonalCfoDashboardView,
    PersonalCfoProgressView,
    PersonalCfoSummaryView,
    ProviderLinkTokenView,
    ProviderStatusView,
    ProviderWebhookView,
    SpendingAnomalyView,
    SpendingSummaryView,
    TransactionViewSet,
)

router = DefaultRouter()
router.register(
    r"budgeting/linked-accounts",
    LinkedAccountViewSet,
    basename="budgeting-linked-account",
)
router.register(
    r"budgeting/transactions",
    TransactionViewSet,
    basename="budgeting-transaction",
)
router.register(
    r"budgeting/envelopes",
    BudgetEnvelopeViewSet,
    basename="budgeting-envelope",
)

urlpatterns = [
    path("", include(router.urls)),
    path(
        "budgeting/spending-summary/",
        SpendingSummaryView.as_view(),
        name="budgeting-spending-summary",
    ),
    path(
        "budgeting/anomalies/",
        SpendingAnomalyView.as_view(),
        name="budgeting-anomalies",
    ),
    path(
        "budgeting/provider-status/",
        ProviderStatusView.as_view(),
        name="budgeting-provider-status",
    ),
    path(
        "budgeting/provider/link-token/",
        ProviderLinkTokenView.as_view(),
        name="budgeting-provider-link-token",
    ),
    path(
        "budgeting/provider/webhook/",
        ProviderWebhookView.as_view(),
        name="budgeting-provider-webhook",
    ),
    path(
        "personal-cfo/summary/",
        PersonalCfoSummaryView.as_view(),
        name="personal-cfo-summary",
    ),
    path(
        "personal-cfo/dashboard/",
        PersonalCfoDashboardView.as_view(),
        name="personal-cfo-dashboard",
    ),
    path(
        "personal-cfo/progress/",
        PersonalCfoProgressView.as_view(),
        name="personal-cfo-progress",
    ),
    path(
        "personal-cfo/coach/",
        PersonalCfoCoachView.as_view(),
        name="personal-cfo-coach",
    ),
]
