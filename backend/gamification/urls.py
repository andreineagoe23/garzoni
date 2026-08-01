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
    RewardLedgerFeedView,
    WeeklyRecapView,
    MissionSwapView,
    StreakItemView,
    MissionGenerationView,
    MissionAnalyticsView,
    AsyncDuelView,
    StreakWagerView,
    StreakWagerCancelView,
    LeagueCurrentView,
    LeagueHistoryView,
)
from .views_duels import (
    DuelListCreateView,
    DuelHistoryView,
    DuelDetailView,
    DuelRespondView,
    DuelCancelView,
    DuelFinalizeView,
)

router = DefaultRouter()
router.register(r"badges", BadgeViewSet, basename="badge")
router.register(r"user-badges", UserBadgeViewSet, basename="userbadge")

urlpatterns = [
    path("", include(router.urls)),
    path("missions/", MissionView.as_view(), name="missions"),
    path(
        "missions/<int:mission_id>/update/",
        MissionView.as_view(),
        name="mission-update",
    ),
    path("missions/complete/", MissionCompleteView.as_view(), name="mission-complete"),
    path("missions/swap/", MissionSwapView.as_view(), name="mission-swap"),
    path("missions/generate/", MissionGenerationView.as_view(), name="mission-generate"),
    path("missions/analytics/", MissionAnalyticsView.as_view(), name="mission-analytics"),
    path("streak-items/", StreakItemView.as_view(), name="streak-items"),
    path("streak-wagers/", StreakWagerView.as_view(), name="streak-wagers"),
    path(
        "streak-wagers/<int:wager_id>/cancel/",
        StreakWagerCancelView.as_view(),
        name="streak-wagers-cancel",
    ),
    path("leaderboard/", LeaderboardViewSet.as_view(), name="leaderboard"),
    path("leaderboard/duel/", AsyncDuelView.as_view(), name="leaderboard-duel"),
    path("leaderboard/rank/", UserRankView.as_view(), name="user-rank"),
    path("recent-activity/", RecentActivityView.as_view(), name="recent-activity"),
    path("reward-ledger/", RewardLedgerFeedView.as_view(), name="reward-ledger"),
    path("weekly-recap/", WeeklyRecapView.as_view(), name="weekly-recap"),
    path("leagues/current/", LeagueCurrentView.as_view(), name="leagues-current"),
    path("leagues/history/", LeagueHistoryView.as_view(), name="leagues-history"),
    # Persistent XP-race duels (multi-day challenges)
    path("duels/", DuelListCreateView.as_view(), name="duels-list-create"),
    path("duels/history/", DuelHistoryView.as_view(), name="duels-history"),
    path("duels/<int:duel_id>/", DuelDetailView.as_view(), name="duels-detail"),
    path("duels/<int:duel_id>/respond/", DuelRespondView.as_view(), name="duels-respond"),
    path("duels/<int:duel_id>/cancel/", DuelCancelView.as_view(), name="duels-cancel"),
    path("duels/<int:duel_id>/finalize/", DuelFinalizeView.as_view(), name="duels-finalize"),
]
