# support/urls.py
from django.urls import path
from .views import SupportListView, vote_support, contact_us
from .views_openai import OpenAIProxyView, ConversationHistoryView
from .views_voice import VoiceTutorView
from .views_scan import ReceiptScanView
from .views_smart_resume import SmartResumeView

urlpatterns = [
    path("support/", SupportListView.as_view(), name="support-list"),
    path("support/<int:support_id>/vote/", vote_support, name="support-vote"),
    path("contact/", contact_us, name="contact-us"),
    path("proxy/openai/", OpenAIProxyView.as_view(), name="openai-proxy"),
    path("conversation/history/", ConversationHistoryView.as_view(), name="conversation-history"),
    path("voice-tutor/", VoiceTutorView.as_view(), name="voice-tutor"),
    path("scan/", ReceiptScanView.as_view(), name="receipt-scan"),
    path("smart-resume/", SmartResumeView.as_view(), name="smart-resume"),
]
