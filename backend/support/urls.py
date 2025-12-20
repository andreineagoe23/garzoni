# support/urls.py
from django.urls import path
from .views import (
    FAQListView,
    vote_faq,
    contact_us,
    OpenRouterProxyView,
)

urlpatterns = [
    path("faq/", FAQListView.as_view(), name="faq-list"),
    path("faq/<int:faq_id>/vote/", vote_faq, name="faq-vote"),
    path("contact/", contact_us, name="contact-us"),
    path("proxy/openrouter/", OpenRouterProxyView.as_view(), name="openrouter-proxy"),
]
