# core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, CourseViewSet, LessonViewSet, QuizViewSet, PathViewSet, RegisterView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UserProgressViewSet
from django.conf import settings
from django.conf.urls.static import static

router = DefaultRouter()
router.register(r'userprogress', UserProgressViewSet)
router.register(r'userprofiles', UserProfileViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'lessons', LessonViewSet)
router.register(r'quizzes', QuizViewSet)
router.register(r'paths', PathViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
