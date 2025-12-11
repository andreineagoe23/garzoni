# gamification/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MissionView,
    MissionCompleteView,
    LeaderboardViewSet,
    UserRankView,
    BadgeViewSet,
    UserBadgeViewSet,
    RecentActivityView,
    MissionSwapView,
    StreakItemView,
    MissionGenerationView,
    MissionAnalyticsView,
)

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'user-badges', UserBadgeViewSet, basename='userbadge')

urlpatterns = [
    path('', include(router.urls)),
    path('missions/', MissionView.as_view(), name='missions'),
    path('missions/<int:mission_id>/update/', MissionView.as_view(), name='mission-update'),
    path('missions/complete/', MissionCompleteView.as_view(), name='mission-complete'),
    path('missions/swap/', MissionSwapView.as_view(), name='mission-swap'),
    path('missions/generate/', MissionGenerationView.as_view(), name='mission-generate'),
    path('missions/analytics/', MissionAnalyticsView.as_view(), name='mission-analytics'),
    path('streak-items/', StreakItemView.as_view(), name='streak-items'),
    path('leaderboard/', LeaderboardViewSet.as_view(), name='leaderboard'),
    path('leaderboard/rank/', UserRankView.as_view(), name='user-rank'),
    path('recent-activity/', RecentActivityView.as_view(), name='recent-activity'),
]

