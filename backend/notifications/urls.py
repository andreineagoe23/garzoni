from django.urls import path

from notifications.views import ClientTrackEventView, CioPingView

urlpatterns = [
    path(
        "notifications/cio-ping/",
        CioPingView.as_view(),
        name="notifications_cio_ping",
    ),
    path(
        "notifications/client-track/",
        ClientTrackEventView.as_view(),
        name="notifications_client_track",
    ),
]
