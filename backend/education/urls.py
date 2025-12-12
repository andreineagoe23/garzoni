# education/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PathViewSet,
    CourseViewSet,
    LessonViewSet,
    QuizViewSet,
    UserProgressViewSet,
    ExerciseViewSet,
    EnhancedQuestionnaireView,
    PersonalizedPathView,
    get_exercise_progress,
    reset_exercise,
    review_queue,
    next_exercise,
    mastery_summary,
)

router = DefaultRouter()
router.register(r'paths', PathViewSet, basename='path')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'quizzes', QuizViewSet, basename='quiz')
router.register(r'userprogress', UserProgressViewSet, basename='userprogress')
router.register(r'exercises', ExerciseViewSet, basename='exercise')

urlpatterns = [
    path('', include(router.urls)),
    path('enhanced-questionnaire/', EnhancedQuestionnaireView.as_view(), name='enhanced-questionnaire'),
    path('personalized-path/', PersonalizedPathView.as_view(), name='personalized-path'),
    path('exercises/progress/<int:exercise_id>/', get_exercise_progress, name='exercise-progress'),
    path('exercises/reset/', reset_exercise, name='reset-exercise'),
    path('review-queue/', review_queue, name='review-queue'),
    path('mastery-summary/', mastery_summary, name='mastery-summary'),
    path('next/', next_exercise, name='next-exercise'),
    path('progress/complete/', UserProgressViewSet.as_view({'post': 'complete'}), name='progress-complete'),
]

