from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserProfileViewSet,
    CourseViewSet,
    LessonViewSet,
    QuizViewSet,
    PathViewSet,
    RegisterView,
    UserProgressViewSet,
    LeaderboardViewSet,
    UserSettingsView,
    UserProfileView,
    MissionView,
    QuestionnaireView,
    ChatbotView,
    ToolListView,
    SavingsGoalCalculatorView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    SavingsAccountView,
    FinanceFactView,
    RecommendationView,
    QuestionnaireSubmitView,
    PersonalizedPathView,
    get_exercise_progress,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from core.views import CookieTokenObtainPairView, LogoutView


# Set up routers
router = DefaultRouter()
router.register(r'userprogress', UserProgressViewSet, basename='userprogress')
router.register(r'userprofiles', UserProfileViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'lessons', LessonViewSet)
router.register(r'quizzes', QuizViewSet)
router.register(r'paths', PathViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),

    path('login/', CookieTokenObtainPairView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('progress/complete/', UserProgressViewSet.as_view({'post': 'complete'}), name='progress-complete'),
    path('userprofiles/update/', UserProfileViewSet.as_view({'put': 'update_profile'}), name='update-profile'),

    path("userprofile/", UserProfileView.as_view(), name="userprofile"),
    path("userprofiles/", include(router.urls)),  

    path('leaderboard/', LeaderboardViewSet.as_view(), name='leaderboard'),
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),

    path("missions/", MissionView.as_view(), name="missions"),
    path("missions/<int:mission_id>/update/", MissionView.as_view(), name="mission-update"),
    path("savings-account/", SavingsAccountView.as_view(), name="savings-account"),
    path("finance-fact/", FinanceFactView.as_view(), name="finance-fact"),

    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset-confirm/<uidb64>/<token>/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    path('questionnaire/', QuestionnaireView.as_view(), name='questionnaire'),
    path('questionnaire/submit/', QuestionnaireSubmitView.as_view(), name='questionnaire-submit'),
    path('recommendation/<int:user_id>/', RecommendationView.as_view(), name='recommendation'),
    path("personalized-path/", PersonalizedPathView.as_view(), name="personalized-path"),

    path('ckeditor/', include('ckeditor_uploader.urls')),

    path('chatbot/', ChatbotView.as_view(), name='chatbot'),
    path('chatbot/webhook/', ChatbotView.dialogflow_webhook, name='chatbot-webhook'),

    path('tools/', ToolListView.as_view(), name='tool-list'),
    path('calculate-savings-goal/', SavingsGoalCalculatorView.as_view(), name='calculate_savings_goal'),

    path('exercises/progress/<int:exercise_id>/', get_exercise_progress, name='exercise-progress'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
