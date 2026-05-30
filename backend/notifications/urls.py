from django.urls import path

from notifications.views import ClientTrackEventView, CioPingView, CioWebhookView

urlpatterns = [
    path(
        "notifications/cio-ping/",
        CioPingView.as_view(),
        name="notifications_cio_ping",
    ),
    path(
        "notifications/cio-webhook/",
        CioWebhookView.as_view(),
        name="notifications_cio_webhook",
    ),
    path(
        "notifications/client-track/",
        ClientTrackEventView.as_view(),
        name="notifications_client_track",
    ),
]
