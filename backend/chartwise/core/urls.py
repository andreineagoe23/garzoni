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
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views

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
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('progress/complete/', UserProgressViewSet.as_view({'post': 'complete'}), name='progress-complete'),
    path('userprofiles/update/', UserProfileViewSet.as_view({'put': 'update_profile'}), name='update-profile'),

    path("userprofile/", UserProfileView.as_view(), name="userprofile"),  # For logged-in user
    path("userprofiles/", include(router.urls)),  # For admin or general list

    path('leaderboard/', LeaderboardViewSet.as_view(), name='leaderboard'),
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),

    path("missions/", MissionView.as_view(), name="mission-list"),
    path("missions/<int:mission_id>/complete/", MissionView.as_view(), name="mission-complete"),

    path('password-reset/', auth_views.PasswordResetView.as_view(), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(), name='password_reset_done'),
    path('password-reset-confirm/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password-reset-complete/', auth_views.PasswordResetCompleteView.as_view(), name='password_reset_complete'),

    path('questionnaire/', QuestionnaireView.as_view(), name='questionnaire'),

    path('ckeditor/', include('ckeditor_uploader.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)