# support/urls.py
from django.urls import path
from .views import SupportListView, vote_support, contact_us
from .views_openrouter import OpenRouterProxyView

urlpatterns = [
    path("support/", SupportListView.as_view(), name="support-list"),
    path("support/<int:support_id>/vote/", vote_support, name="support-vote"),
    path("contact/", contact_us, name="contact-us"),
    path("proxy/openrouter/", OpenRouterProxyView.as_view(), name="openrouter-proxy"),
]
