from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from education.models import (
    Course,
    Exercise,
    ExerciseTranslation,
    Lesson,
    LessonSection,
    LessonSectionTranslation,
    Path,
    Quiz,
    QuizTranslation,
)
from education.serializers import ExerciseSerializer, LessonSectionSerializer, QuizSerializer
from education.services.translation import OpenAIPaymentRequiredError, OpenAITranslator


def _response(status, body):
    resp = MagicMock(status_code=status)
    resp.json.return_value = body
    return resp


@override_settings(OPENAI_API_KEY="test")
@patch("education.services.translation.time.sleep")
@patch("education.services.translation.requests.post")
class TranslatorQuotaTests(SimpleTestCase):
    def test_exhausted_balance_aborts_instead_of_returning_the_source(self, post, sleep):
        post.return_value = _response(429, {"error": {"code": "insufficient_quota"}})
        with self.assertRaises(OpenAIPaymentRequiredError):
            OpenAITranslator().translate_text("Budget")
        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()

    def test_plain_rate_limit_still_retries(self, post, sleep):
        post.return_value = _response(429, {"error": {"code": "rate_limit_exceeded"}})
        self.assertEqual(OpenAITranslator().translate_text("Budget"), "Budget")
        self.assertEqual(post.call_count, 3)


class TranslationFallbackTests(TestCase):
    def setUp(self):
        path = Path.objects.create(title="Basic Finance", description="d")
        self.course = Course.objects.create(path=path, title="Budgeting", description="d")
        self.lesson = Lesson.objects.create(
            course=self.course,
            title="What is a budget?",
            short_description="d",
            detailed_content="<p>d</p>",
        )
        self.request = RequestFactory().get("/", HTTP_X_APP_LANGUAGE="ro")
        self.request.user = AnonymousUser()

    def _data(self, serializer_class, instance):
        return serializer_class(instance, context={"request": self.request}).data

    def _quiz(self):
        return Quiz.objects.create(
            course=self.course,
            lesson=self.lesson,
            title="Check",
            question="Which?",
            choices=[{"text": "a"}, {"text": "b"}],
            correct_answer="a",
        )

    def _exercise(self):
        return Exercise.objects.create(
            type="multiple-choice",
            question="Which?",
            exercise_data={"options": ["a", "b", "c", "d"]},
            correct_answer=0,
            category="Budgeting",
            is_published=True,
        )

    def test_quiz_uses_a_complete_translation(self):
        quiz = self._quiz()
        QuizTranslation.objects.create(
            quiz=quiz,
            language="ro",
            title="Verificare",
            question="Care?",
            choices=[{"text": "ro-a"}, {"text": "ro-b"}],
            correct_answer="ro-a",
        )
        data = self._data(QuizSerializer, quiz)
        self.assertEqual(data["question"], "Care?")
        self.assertEqual(data["correct_answer"], "ro-a")

    def test_quiz_with_blanked_choices_falls_back_to_english(self):
        # apply_manual_option_rewrites keeps the question and blanks the choices.
        quiz = self._quiz()
        QuizTranslation.objects.create(
            quiz=quiz,
            language="ro",
            title="Verificare",
            question="Care?",
            choices=[],
            correct_answer="",
        )
        data = self._data(QuizSerializer, quiz)
        self.assertEqual(data["question"], "Which?")
        self.assertEqual(data["choices"], [{"text": "a"}, {"text": "b"}])
        self.assertEqual(data["correct_answer"], "a")

    def test_exercise_uses_an_aligned_translation(self):
        ex = self._exercise()
        ExerciseTranslation.objects.create(
            exercise=ex,
            language="ro",
            question="Care?",
            exercise_data={"options": ["ro-a", "ro-b", "ro-c", "ro-d"]},
        )
        data = self._data(ExerciseSerializer, ex)
        self.assertEqual(data["question"], "Care?")
        self.assertEqual(data["exercise_data"]["options"], ["ro-a", "ro-b", "ro-c", "ro-d"])

    def test_exercise_with_blanked_question_falls_back_to_english(self):
        # push_rewrites_to_railway sets question = '' and exercise_data = {}.
        ex = self._exercise()
        ExerciseTranslation.objects.create(
            exercise=ex, language="ro", question="", exercise_data={}
        )
        data = self._data(ExerciseSerializer, ex)
        self.assertEqual(data["question"], "Which?")

    def test_exercise_with_stale_options_falls_back_to_english(self):
        ex = self._exercise()
        ExerciseTranslation.objects.create(
            exercise=ex,
            language="ro",
            question="Care?",
            exercise_data={"options": ["ro-a", "ro-b", "ro-c"]},
        )
        data = self._data(ExerciseSerializer, ex)
        self.assertEqual(data["question"], "Which?")
        self.assertEqual(data["exercise_data"]["options"], ["a", "b", "c", "d"])

    def test_section_with_stale_options_keeps_english_options(self):
        section = LessonSection.objects.create(
            lesson=self.lesson,
            order=1,
            title="Knowledge Check",
            content_type="exercise",
            exercise_type="multiple-choice",
            is_published=True,
            exercise_data={
                "question": "Which?",
                "options": ["a", "b", "c", "d"],
                "correctAnswer": 0,
            },
        )
        LessonSectionTranslation.objects.create(
            section=section,
            language="ro",
            title="Verificare",
            exercise_data={"question": "Care?", "options": ["ro-a", "ro-b"], "correctAnswer": 1},
        )
        data = self._data(LessonSectionSerializer, section)
        self.assertEqual(data["title"], "Verificare")
        self.assertEqual(data["exercise_data"]["options"], ["a", "b", "c", "d"])
