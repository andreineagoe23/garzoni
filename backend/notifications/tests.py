from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from authentication.models import UserEmailPreference, UserProfile
from notifications.customer_io import load_transactional_map
from notifications.idempotency import idempotency_already_sent
from notifications.message_data import (
    build_weekly_digest_message_data,
    flatten_context_for_cio,
    normalize_scalar_for_message_data,
    weekly_digest_week_bounds,
)
from notifications.service import NotificationService
from notifications.tasks import send_ai_nudge_task


class ExpoPushTests(TestCase):
    @patch("notifications.expo_push.requests.post")
    def test_send_expo_push_accepts_single_ticket_object(self, mock_post):
        from notifications.expo_push import send_expo_push

        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-id"}}
        mock_post.return_value = response

        ok, err = send_expo_push("ExponentPushToken[abc]", "Title", "Body")

        self.assertTrue(ok)
        self.assertIsNone(err)

    @patch("notifications.expo_push.requests.post")
    def test_send_expo_push_reports_single_ticket_error(self, mock_post):
        from notifications.expo_push import send_expo_push

        response = Mock(status_code=200, text="")
        response.json.return_value = {
            "data": {
                "status": "error",
                "message": "DeviceNotRegistered",
            }
        }
        mock_post.return_value = response

        ok, err = send_expo_push("ExponentPushToken[abc]", "Title", "Body")

        self.assertFalse(ok)
        self.assertEqual(err, "DeviceNotRegistered")


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

    @patch("notifications.tasks.NotificationService.sync_user_profile")
    @patch("notifications.transactional.TransactionalMessages.send_push")
    @patch("education.services.ai_tutor.generate_push_nudge")
    def test_send_ai_nudge_task_routes_to_push_when_token_present(
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

        self.assertEqual(result, "sent_push")
        mock_send_push.assert_called_once()

    @patch("notifications.tasks.NotificationService.sync_user_profile")
    @patch("notifications.transactional.TransactionalMessages.send_push")
    @patch("education.services.ai_tutor.generate_push_nudge")
    def test_send_ai_nudge_task_falls_back_to_email_when_no_token(
        self, mock_generate_nudge, mock_send_push, mock_sync_profile
    ):
        # No expo token → resolver picks email path; push send never attempted.
        UserProfile.objects.filter(user=self.user).update(expo_push_token="")
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.push_notifications = True
        prefs.reminders = True
        prefs.save(update_fields=["push_notifications", "reminders"])
        mock_generate_nudge.return_value = "Time for a 5-minute lesson."
        mock_sync_profile.return_value = (True, None)

        result = send_ai_nudge_task(user_pk=self.user.pk)

        # No CIO transactional config and no SMTP in tests → skipped_no_channel.
        # The key invariant: push was NOT attempted when the user has no token.
        mock_send_push.assert_not_called()
        self.assertIn(result, {"skipped_no_channel", "sent_smtp", "sent_cio"})


class ResolveChannelsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="route-user", email="route@example.com", password="pass12345"
        )
        UserProfile.objects.get_or_create(user=self.user)

    def _set_token(self, value: str) -> None:
        UserProfile.objects.filter(user=self.user).update(expo_push_token=value)

    def test_marketing_with_token_routes_push_only(self):
        from notifications.policy import NotificationCategory, resolve_channels

        self._set_token("ExponentPushToken[xyz]")
        d = resolve_channels(self.user, NotificationCategory.MARKETING)
        self.assertTrue(d.push)
        self.assertFalse(d.email)

    def test_marketing_without_token_falls_back_to_email(self):
        from notifications.policy import NotificationCategory, resolve_channels

        self._set_token("")
        d = resolve_channels(self.user, NotificationCategory.MARKETING)
        self.assertFalse(d.push)
        self.assertTrue(d.email)

    def test_critical_always_email_plus_push_if_token(self):
        from notifications.policy import NotificationCategory, resolve_channels

        self._set_token("ExponentPushToken[xyz]")
        d = resolve_channels(self.user, NotificationCategory.TRANSACTIONAL_CRITICAL)
        self.assertTrue(d.email)
        self.assertTrue(d.push)

        self._set_token("")
        d = resolve_channels(self.user, NotificationCategory.TRANSACTIONAL_CRITICAL)
        self.assertTrue(d.email)
        self.assertFalse(d.push)


class TransactionalEmailIdentifiersTests(TestCase):
    """Transactional email must set ``to`` and include ``email`` in identifiers for CIO Liquid."""

    @override_settings(
        CIO_TRANSACTIONAL_ENABLED=True,
        CIO_APP_API_KEY="test-app-key",
        CIO_TRANSACTIONAL_TRIGGERS_JSON='{"welcome": 8}',
    )
    @patch("notifications.transactional.send_transactional_email")
    def test_send_includes_id_and_email_identifiers(self, mock_send):
        mock_send.return_value = (True, None)
        user = User.objects.create_user(
            username="cio-ident",
            email="cio-ident@example.com",
            password="pass12345",
        )
        from notifications.enums import CioTemplate
        from notifications.transactional import TransactionalMessages

        tm = TransactionalMessages()
        ok, err = tm.send(
            CioTemplate.WELCOME,
            user,
            {"customer_name": "Pat", "app_url": "https://garzoni.app", "year": 2026},
        )
        self.assertTrue(ok)
        self.assertIsNone(err)
        mock_send.assert_called_once()
        kwargs = mock_send.call_args[1]
        self.assertEqual(kwargs["to_email"], "cio-ident@example.com")
        self.assertEqual(kwargs["identifiers"]["id"], str(user.pk))
        self.assertEqual(kwargs["identifiers"]["email"], "cio-ident@example.com")


class WeeklyDigestMessageDataTests(TestCase):
    def test_required_keys_present(self):
        user = User.objects.create_user(
            username="digest-u",
            email="digest@example.com",
            password="pass12345",
        )
        profile = user.profile
        monday, metrics_end, sunday = weekly_digest_week_bounds()
        md = build_weekly_digest_message_data(
            user=user,
            profile=profile,
            metrics_start=monday,
            metrics_end=metrics_end,
            label_start=monday,
            label_end=sunday,
        )
        for k in (
            "week_label",
            "modules_completed",
            "modules_completed_plural",
            "streak_days",
            "xp_earned",
        ):
            self.assertIn(k, md)
        self.assertIsInstance(md["modules_completed"], int)
        self.assertIn(md["modules_completed_plural"], ("", "s"))


class FlattenContextTests(TestCase):
    def test_decimal_normalized(self):
        from decimal import Decimal

        ctx = {"coins_spent_this_week": Decimal("12.50"), "name": "x"}
        flat = flatten_context_for_cio(ctx)
        self.assertEqual(flat["name"], "x")
        self.assertIn("coins_spent_this_week", flat)

    def test_normalize_bool_before_int(self):
        self.assertIs(normalize_scalar_for_message_data(False), False)


class WelcomeIdempotencyTests(TestCase):
    @override_settings(
        CIO_TRANSACTIONAL_ENABLED=True,
        CIO_APP_API_KEY="k",
        CIO_TRANSACTIONAL_TRIGGERS_JSON='{"welcome": 3}',
        CIO_TRACK_ENABLED=False,
    )
    @patch("notifications.transactional.send_transactional_email")
    def test_idempotency_recorded_only_after_success(self, mock_send):
        mock_send.return_value = (False, "HTTP 500: err")
        user = User.objects.create_user(
            username="idem-u",
            email="idem@example.com",
            password="pass12345",
        )
        svc = NotificationService()
        out = svc.send_welcome(user, idempotency_key="welcome:idempotency-fail")
        self.assertTrue(out.startswith("cio_failed"))
        self.assertFalse(idempotency_already_sent("welcome:idempotency-fail"))

        mock_send.return_value = (True, None)
        out2 = svc.send_welcome(user, idempotency_key="welcome:idempotency-ok")
        self.assertEqual(out2, "sent_cio")
        self.assertTrue(idempotency_already_sent("welcome:idempotency-ok"))
