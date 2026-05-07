from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from authentication.models import UserEmailPreference, UserProfile
from notifications.customer_io import load_transactional_map
from notifications.tasks import send_ai_nudge_task


class NotificationConfigTests(TestCase):
    @override_settings(
        CIO_TRANSACTIONAL_TRIGGERS_JSON="{password-reset:3,welcome:4,portfolio-update:19,ai-nudge:20}"
    )
    def test_load_transactional_map_accepts_loose_map_format(self):
        trigger_map = load_transactional_map()
        self.assertEqual(trigger_map.get("password-reset"), 3)
        self.assertEqual(trigger_map.get("portfolio-update"), 19)
        self.assertEqual(trigger_map.get("ai-nudge"), 20)


class AiNudgeTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="nudge-user",
            email="nudge@example.com",
            password="pass12345",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.expo_push_token = "ExponentPushToken[abc]"
        profile.save(update_fields=["expo_push_token"])

    def test_send_ai_nudge_task_skips_when_push_policy_denied(self):
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.push_notifications = False
        prefs.marketing = False
        prefs.save(update_fields=["push_notifications", "marketing"])
        result = send_ai_nudge_task(user_pk=self.user.pk)
        self.assertEqual(result, "skipped_policy:push_master_off")

    @patch("notifications.tasks.NotificationService.sync_user_profile")
    @patch("notifications.transactional.TransactionalMessages.send_push")
    @patch("education.services.ai_tutor.generate_push_nudge")
    def test_send_ai_nudge_task_returns_sent(
        self, mock_generate_nudge, mock_send_push, mock_sync_profile
    ):
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.push_notifications = True
        prefs.marketing = True
        prefs.save(update_fields=["push_notifications", "marketing"])
        mock_generate_nudge.return_value = "Markets moved today."
        mock_send_push.return_value = (True, None)
        mock_sync_profile.return_value = (True, None)

        result = send_ai_nudge_task(user_pk=self.user.pk)

        self.assertEqual(result, "sent")
        mock_send_push.assert_called_once()
