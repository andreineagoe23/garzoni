from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import (
    CustomTokenRefreshView,
    CourseViewSet,
    LessonViewSet,
    QuizViewSet,
    PathViewSet,
    UserProgressViewSet,
    LeaderboardViewSet,
    UserSettingsView,
    UserProfileView,
    MissionView,
    SavingsGoalCalculatorView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    SavingsAccountView,
    FinanceFactView,
    PersonalizedPathView,
    get_exercise_progress,
    RecentActivityView,
    RewardViewSet,
    UserPurchaseViewSet,
    get_csrf_token,
    UserBadgeViewSet,
    BadgeViewSet,
    update_avatar,
    FriendRequestView,
    FriendsLeaderboardView,
    ExerciseViewSet,
    EnhancedQuestionnaireView,
    reset_exercise,
    StripeWebhookView,
    VerifySessionView,
    LoginSecureView,
    RegisterSecureView,
    VerifyAuthView,
    OpenRouterProxyView,
    contact_us,
    FAQListView,
    vote_faq,
    delete_account,
    UserRankView,
    PortfolioViewSet,
    FinancialGoalViewSet
)
from rest_framework_simplejwt.views import TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from core.views import LogoutView

router = DefaultRouter()
router.register(r'userprogress', UserProgressViewSet, basename='userprogress')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'quizzes', QuizViewSet, basename='quiz')
router.register(r'paths', PathViewSet, basename='path')
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'user-badges', UserBadgeViewSet, basename='userbadge')
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'friend-requests', FriendRequestView, basename='friend-request')
router.register(r'portfolio', PortfolioViewSet, basename='portfolio')
router.register(r'financial-goals', FinancialGoalViewSet, basename='financial-goals')

urlpatterns = [
    path('', include(router.urls)),
    path('csrf/', get_csrf_token, name='get_csrf_token'),

    path('logout/', LogoutView.as_view(), name='logout'),

    path('login-secure/', LoginSecureView.as_view(), name='login-secure'),
    path('register-secure/', RegisterSecureView.as_view(), name='register-secure'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token-refresh'),
    path('verify-auth/', VerifyAuthView.as_view(), name='verify-auth'),

    path('progress/complete/', UserProgressViewSet.as_view({'post': 'complete'}), name='progress-complete'),

    path("userprofile/", UserProfileView.as_view(), name="userprofile"),
    path('update-avatar/', views.update_avatar, name='update_avatar'),

    path('leaderboard/', LeaderboardViewSet.as_view(), name='leaderboard'),
    path('leaderboard/rank/', UserRankView.as_view(), name='user-rank'),
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),

    path("missions/", MissionView.as_view(), name="missions"),
    path("missions/<int:mission_id>/update/", MissionView.as_view(), name="mission-update"),
    path("savings-account/", SavingsAccountView.as_view(), name="savings-account"),
    path("finance-fact/", FinanceFactView.as_view(), name="finance-fact"),

    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset-confirm/<uidb64>/<token>/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    path('enhanced-questionnaire/', EnhancedQuestionnaireView.as_view(), name='enhanced-questionnaire'),
    path('personalized-path/', PersonalizedPathView.as_view(), name='personalized-path'),

    path('stripe-webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('verify-session/', VerifySessionView.as_view(), name='verify-session'),

    path('exercises/reset/', reset_exercise, name='reset-exercise'),

    path('ckeditor/', include('ckeditor_uploader.urls')),

    path('calculate-savings-goal/', SavingsGoalCalculatorView.as_view(), name='calculate_savings_goal'),

    path('exercises/progress/<int:exercise_id>/', get_exercise_progress, name='exercise-progress'),
    path('recent-activity/', RecentActivityView.as_view(), name='recent-activity'),

    path('rewards/shop/', RewardViewSet.as_view({'get': 'list'}), {'type': 'shop'}, name='shop-rewards'),
    path('rewards/donate/', RewardViewSet.as_view({'get': 'list'}), {'type': 'donate'}, name='donate-rewards'),
    path('purchases/', UserPurchaseViewSet.as_view({'post': 'create'}), name='purchases-create'),

    path('leaderboard/friends/', FriendsLeaderboardView.as_view(), name='friends-leaderboard'),

    path('proxy/openrouter/', OpenRouterProxyView.as_view(), name='openrouter-proxy'),
    path('change-password/', views.change_password, name='change-password'),
    path('delete-account/', delete_account, name='delete-account'),
    path('contact/', contact_us, name='contact-us'),

    path('faq/', FAQListView.as_view(), name='faq-list'),
    path('faq/<int:faq_id>/vote/', vote_faq, name='faq-vote'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
