# gamification/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MissionView,
    LeaderboardViewSet,
    UserRankView,
    BadgeViewSet,
    UserBadgeViewSet,
    RecentActivityView,
)

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'user-badges', UserBadgeViewSet, basename='userbadge')

urlpatterns = [
    path('', include(router.urls)),
    path('missions/', MissionView.as_view(), name='missions'),
    path('missions/<int:mission_id>/update/', MissionView.as_view(), name='mission-update'),
    path('leaderboard/', LeaderboardViewSet.as_view(), name='leaderboard'),
    path('leaderboard/rank/', UserRankView.as_view(), name='user-rank'),
    path('recent-activity/', RecentActivityView.as_view(), name='recent-activity'),
]

