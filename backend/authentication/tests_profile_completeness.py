"""profile_completeness meter math (UX Phase 3, plan §3.3).

Weights: questionnaire 40, first lesson 20, name 10, avatar 10,
notifications (push token) 10, any tool used 10. A fresh post-quiz user lands
~40-50 and never 0; completeness_next names the highest-value missing item.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from django.core.cache import cache

from authentication.services.profile import build_profile_payload
from onboarding.models import QuestionnaireProgress, QuestionnaireVersion


class ProfileCompletenessTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="completeness_user", password="pass")
        self.profile = self.user.profile
        self.version = QuestionnaireVersion.objects.create(
            version=998, is_active=True, questionnaire_structure={"sections": []}
        )

    def _payload(self):
        # The payload is cached per (user, month); clear so each assertion recomputes.
        cache.clear()
        return build_profile_payload(self.user, self.profile)

    def _complete_questionnaire(self):
        QuestionnaireProgress.objects.create(
            user=self.user, version=self.version, status="completed"
        )

    def test_bare_user_is_zero_and_points_at_questionnaire(self):
        payload = self._payload()
        self.assertEqual(payload["profile_completeness"], 0)
        self.assertEqual(payload["completeness_next"], "questionnaire")

    def test_fresh_post_quiz_user_lands_40(self):
        self._complete_questionnaire()
        payload = self._payload()
        self.assertEqual(payload["profile_completeness"], 40)
        # Highest-value missing item after the questionnaire is the first lesson.
        self.assertEqual(payload["completeness_next"], "first_lesson")

    def test_weights_accumulate(self):
        self._complete_questionnaire()
        self.user.first_name = "Ada"
        self.user.save(update_fields=["first_name"])
        self.profile.first_lesson_at = timezone.now()
        self.profile.profile_avatar = "https://cdn.example.com/a.png"
        self.profile.expo_push_token = "ExponentPushToken[abc]"
        self.profile.save(update_fields=["first_lesson_at", "profile_avatar", "expo_push_token"])
        payload = self._payload()
        # 40 + 20 + 10 + 10 + 10 = 90; only "any tool used" (10) is missing.
        self.assertEqual(payload["profile_completeness"], 90)
        self.assertEqual(payload["completeness_next"], "tool")

    def test_mirrored_into_user_data(self):
        self._complete_questionnaire()
        payload = self._payload()
        self.assertEqual(
            payload["user_data"]["profile_completeness"], payload["profile_completeness"]
        )
        self.assertEqual(payload["user_data"]["completeness_next"], payload["completeness_next"])
