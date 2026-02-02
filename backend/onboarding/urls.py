from django.urls import path
from onboarding.views import (
    QuestionnaireProgressView,
    QuestionnaireNextQuestionView,
    QuestionnaireSaveAnswerView,
    QuestionnaireCompleteView,
    QuestionnaireAbandonView,
    QuestionnaireCleanupView,
)

urlpatterns = [
    path("questionnaire/progress/", QuestionnaireProgressView.as_view(), name="questionnaire-progress"),
    path("questionnaire/next-question/", QuestionnaireNextQuestionView.as_view(), name="questionnaire-next-question"),
    path("questionnaire/save-answer/", QuestionnaireSaveAnswerView.as_view(), name="questionnaire-save-answer"),
    path("questionnaire/complete/", QuestionnaireCompleteView.as_view(), name="questionnaire-complete"),
    path("questionnaire/abandon/", QuestionnaireAbandonView.as_view(), name="questionnaire-abandon"),
    path("questionnaire/cleanup/", QuestionnaireCleanupView.as_view(), name="questionnaire-cleanup"),
]

