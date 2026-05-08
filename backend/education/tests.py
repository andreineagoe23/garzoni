from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from authentication.models import UserProfile
from onboarding.models import QuestionnaireProgress, QuestionnaireVersion


class PersonalizedPathEntitlementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="path-user",
            email="path@example.com",
            password="pass12345",
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)
        self.version = QuestionnaireVersion.objects.create(
            version=999,
            is_active=True,
            questionnaire_structure={"sections": []},
        )
        QuestionnaireProgress.objects.update_or_create(
            user=self.user,
            defaults={
                "version": self.version,
                "status": "completed",
                "answers": {"primary_goal": "invest"},
            },
        )
        self.client.force_authenticate(user=self.user)

    @patch("education.views.PersonalizedPathView._should_regenerate", return_value=False)
    def test_personalized_path_preview_for_disabled_feature(self, _mock_regen):
        with patch(
            "education.views.PersonalizedPathView._personalized_path_enabled",
            return_value=False,
        ):
            response = self.client.get(reverse("personalized-path"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["meta"]["preview"])
        self.assertIn("upgrade_prompt", response.data)

    @patch("education.views.PersonalizedPathView._should_regenerate", return_value=False)
    def test_personalized_path_full_for_enabled_feature(self, _mock_regen):
        with patch(
            "education.views.PersonalizedPathView._personalized_path_enabled",
            return_value=True,
        ):
            response = self.client.get(reverse("personalized-path"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["meta"]["preview"])

    @patch("education.views.PersonalizedPathView._should_regenerate", return_value=False)
    def test_personalized_path_onboarding_goals_are_deduped_and_prettified(self, _mock_regen):
        QuestionnaireProgress.objects.filter(user=self.user).update(
            answers={"primary_goal": "debt", "biggest_challenge": "debt"}
        )
        with patch(
            "education.views.PersonalizedPathView._personalized_path_enabled",
            return_value=True,
        ):
            response = self.client.get(reverse("personalized-path"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["meta"]["onboarding_goals"], ["Debt"])

    @patch("education.views.PersonalizedPathView.generate_recommendations")
    def test_refresh_returns_preview_flag_when_feature_disabled(self, mock_generate):
        with patch(
            "education.views.PersonalizedPathView._personalized_path_enabled",
            return_value=False,
        ):
            response = self.client.post(reverse("personalized-path-refresh"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["preview"])
        mock_generate.assert_called_once()

    @patch("education.views.PersonalizedPathView.generate_recommendations")
    def test_refresh_returns_non_preview_when_feature_enabled(self, mock_generate):
        with patch(
            "education.views.PersonalizedPathView._personalized_path_enabled",
            return_value=True,
        ):
            response = self.client.post(reverse("personalized-path-refresh"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["preview"])
        mock_generate.assert_called_once()

    def test_refresh_requires_completed_onboarding(self):
        QuestionnaireProgress.objects.filter(user=self.user).update(status="in_progress")
        response = self.client.post(reverse("personalized-path-refresh"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("redirect"), "/onboarding")
