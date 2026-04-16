from django.urls import path

from notifications.views import ClientTrackEventView

urlpatterns = [
    path(
        "notifications/client-track/",
        ClientTrackEventView.as_view(),
        name="notifications_client_track",
    ),
]
