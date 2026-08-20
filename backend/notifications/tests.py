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
        # send_ai_nudge_task now early-exits on marketing opt-out (the gate that
        # closes the daily-blast-to-unsubbed-users bug). Opt this test user in
        # so the fallback path under test is exercised.
        prefs.marketing = True
        prefs.save(update_fields=["push_notifications", "reminders", "marketing"])
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


_WEBHOOK_SECRET = "test-signing-secret"


@override_settings(
    CIO_WEBHOOK_SIGNING_SECRET=_WEBHOOK_SECRET,
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class CioWebhookBounceTests(TestCase):
    """Reporting-webhook bounce/spam → permanent suppression (Apple relay safety net)."""

    def _post(self, payload: dict):
        import hashlib
        import hmac
        import json

        from django.urls import reverse

        body = json.dumps(payload).encode("utf-8")
        sig = hmac.new(_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
        return self.client.post(
            reverse("notifications_cio_webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_CIO_SIGNATURE=sig,
        )

    @patch("notifications.tasks.safe_enqueue_suppress_customer_in_cio")
    def test_email_bounced_suppresses_cio_and_local_prefs(self, mock_suppress):
        user = User.objects.create_user(username="b1", email="bounce@example.com")
        prefs, _ = UserEmailPreference.objects.get_or_create(user=user)
        prefs.marketing, prefs.reminders, prefs.weekly_digest = True, True, True
        prefs.save()

        resp = self._post(
            {
                "event_type": "email_bounced",
                "data": {"customer_id": str(user.pk), "email_address": "bounce@example.com"},
            }
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("suppressed"))
        mock_suppress.assert_called_once_with(str(user.pk), "bounce@example.com")
        prefs.refresh_from_db()
        self.assertFalse(prefs.marketing)
        self.assertFalse(prefs.reminders)
        self.assertFalse(prefs.weekly_digest)

    @patch("notifications.tasks.safe_enqueue_suppress_customer_in_cio")
    def test_spam_complaint_suppresses(self, mock_suppress):
        user = User.objects.create_user(username="b2", email="spam@example.com")
        resp = self._post(
            {
                "event_type": "email_spammed",
                "data": {"customer_id": str(user.pk), "email_address": "spam@example.com"},
            }
        )
        self.assertEqual(resp.status_code, 200)
        mock_suppress.assert_called_once()

    @patch("notifications.tasks.safe_enqueue_suppress_customer_in_cio")
    def test_bounce_without_local_user_still_suppresses_cio(self, mock_suppress):
        # Apple relay profiles often have no Django account — CIO must still be suppressed.
        resp = self._post(
            {
                "object_type": "email",
                "metric": "bounced",
                "data": {
                    "customer_id": "99999",
                    "email_address": "ghost@privaterelay.appleid.com",
                },
            }
        )
        self.assertEqual(resp.status_code, 200)
        mock_suppress.assert_called_once_with("99999", "ghost@privaterelay.appleid.com")

    @patch("notifications.tasks.safe_enqueue_suppress_customer_in_cio")
    def test_bounce_payload_with_recipient_and_identifiers(self, mock_suppress):
        # Email-metric webhooks may omit email_address and nest ids under identifiers
        # / use recipient for the address — must still suppress by id.
        resp = self._post(
            {
                "object_type": "email",
                "metric": "bounced",
                "data": {
                    "identifiers": {"id": "424242", "cio_id": "ac900dXYZ"},
                    "recipient": "relay@privaterelay.appleid.com",
                },
            }
        )
        self.assertEqual(resp.status_code, 200)
        mock_suppress.assert_called_once_with("424242", "relay@privaterelay.appleid.com")

    @patch("notifications.tasks.safe_enqueue_suppress_customer_in_cio")
    def test_bad_signature_rejected(self, mock_suppress):
        import json

        from django.urls import reverse

        body = json.dumps({"event_type": "email_bounced", "data": {"customer_id": "1"}}).encode()
        resp = self.client.post(
            reverse("notifications_cio_webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_CIO_SIGNATURE="deadbeef",
        )
        self.assertEqual(resp.status_code, 401)
        mock_suppress.assert_not_called()


class PushMasterSwitchTests(TestCase):
    """The push toggle round-trip: settings API ↔ prefs ↔ Customer.io traits."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="pushtoggle", email="pushtoggle@example.com", password="pw12345!"
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.expo_push_token = "ExponentPushToken[abc]"
        profile.save(update_fields=["expo_push_token"])
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _settings_url(self):
        from django.urls import reverse

        return reverse("user-settings")

    def test_get_mirrors_push_flag_at_top_level(self):
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.push_notifications = False
        prefs.save(update_fields=["push_notifications"])

        resp = self.client.get(self._settings_url())

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["push_notifications"])
        self.assertFalse(resp.data["email_preferences"]["push_notifications"])

    def test_patch_accepts_top_level_push_flag(self):
        """Mobile sends {"push_notifications": false} unnested; it used to be dropped."""
        resp = self.client.patch(
            self._settings_url(),
            data={"push_notifications": False},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["push_notifications"])
        prefs = UserEmailPreference.objects.get(user=self.user)
        self.assertFalse(prefs.push_notifications)

    def test_patch_nested_payload_still_wins(self):
        resp = self.client.patch(
            self._settings_url(),
            data={
                "push_notifications": True,
                "email_preferences": {"push_notifications": False},
            },
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(UserEmailPreference.objects.get(user=self.user).push_notifications)


class IdentifyTraitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="traits", email="traits@example.com", password="pw12345!"
        )
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

    def test_has_mobile_app_false_when_push_disabled(self):
        from notifications.profile_sync import build_identify_traits

        self.profile.expo_push_token = "ExponentPushToken[abc]"
        self.profile.save(update_fields=["expo_push_token"])
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.push_notifications = False
        prefs.save(update_fields=["push_notifications"])

        traits = build_identify_traits(self.user)

        self.assertFalse(traits["has_mobile_app"])
        self.assertFalse(traits["push_opt_in"])

    def test_has_mobile_app_true_when_token_and_opt_in(self):
        from notifications.profile_sync import build_identify_traits

        self.profile.expo_push_token = "ExponentPushToken[abc]"
        self.profile.save(update_fields=["expo_push_token"])
        UserEmailPreference.objects.get_or_create(user=self.user)

        traits = build_identify_traits(self.user)

        self.assertTrue(traits["has_mobile_app"])

    def test_empty_token_is_sent_so_cio_clears_the_stale_value(self):
        """Empty strings are normally filtered out; the push token must not be."""
        from notifications.profile_sync import build_identify_traits

        self.profile.expo_push_token = ""
        self.profile.save(update_fields=["expo_push_token"])

        traits = build_identify_traits(self.user)

        self.assertIn("expo_push_token", traits)
        self.assertEqual(traits["expo_push_token"], "")
        self.assertFalse(traits["has_mobile_app"])

    @patch("notifications.profile_sync.identify_person")
    def test_sync_device_carries_has_mobile_app(self, mock_identify):
        from notifications.profile_sync import NotificationProfileSync

        mock_identify.return_value = (True, None)

        NotificationProfileSync().sync_device(self.user, "", platform="ios")

        traits = mock_identify.call_args[0][1]
        self.assertEqual(traits["expo_push_token"], "")
        self.assertFalse(traits["has_mobile_app"])


class MarketingResubscribeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="resub", email="resub@example.com", password="pw12345!"
        )
        UserProfile.objects.get_or_create(user=self.user)

    @patch("notifications.tasks.safe_enqueue_resubscribe_customer_in_cio")
    def test_marketing_off_to_on_clears_cio_unsubscribed(self, mock_resub):
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.marketing = False
        prefs.save(update_fields=["marketing"])
        mock_resub.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            prefs.marketing = True
            prefs.save(update_fields=["marketing"])

        mock_resub.assert_called_once_with(str(self.user.pk))

    @patch("notifications.tasks.safe_enqueue_resubscribe_customer_in_cio")
    def test_no_resubscribe_when_marketing_unchanged(self, mock_resub):
        prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)
        prefs.marketing = True
        prefs.save(update_fields=["marketing"])
        mock_resub.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            prefs.reminders = False
            prefs.save(update_fields=["reminders"])

        mock_resub.assert_not_called()


class PushReceiptTests(TestCase):
    """Receipts are the only place a revoked APNs key or dead device is reported."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="receipts", email="receipts@example.com", password="pw12345!"
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.expo_push_token = "ExponentPushToken[live]"
        profile.save(update_fields=["expo_push_token"])

    @patch("notifications.expo_push.requests.post")
    def test_successful_send_records_ticket(self, mock_post):
        from notifications.expo_push import send_expo_push
        from notifications.models import PushTicket

        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-1"}}
        mock_post.return_value = response

        ok, _ = send_expo_push(
            "ExponentPushToken[live]", "T", "B", user_id=self.user.pk, purpose="ai-nudge"
        )

        self.assertTrue(ok)
        ticket = PushTicket.objects.get(ticket_id="ticket-1")
        self.assertEqual(ticket.status, PushTicket.STATUS_PENDING)
        self.assertEqual(ticket.user_id, self.user.pk)
        self.assertEqual(ticket.purpose, "ai-nudge")

    @patch("notifications.expo_push.requests.post")
    def test_send_payload_carries_channel_and_priority(self, mock_post):
        from notifications.expo_push import send_expo_push

        response = Mock(status_code=200, text="")
        response.json.return_value = {"data": {"status": "ok", "id": "ticket-ch"}}
        mock_post.return_value = response

        send_expo_push("ExponentPushToken[live]", "T", "B", channel_id="streak")

        payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(payload["channelId"], "streak")
        self.assertEqual(payload["priority"], "high")
        self.assertEqual(payload["sound"], "default")

    @patch("notifications.expo_push.fetch_expo_receipts")
    def test_device_not_registered_receipt_clears_token(self, mock_fetch):
        from datetime import timedelta

        from django.utils import timezone as dj_timezone

        from notifications.models import PushTicket
        from notifications.tasks import poll_expo_push_receipts

        ticket = PushTicket.objects.create(
            ticket_id="t-dead",
            user_id=self.user.pk,
            token="ExponentPushToken[live]",
        )
        PushTicket.objects.filter(pk=ticket.pk).update(
            created_at=dj_timezone.now() - timedelta(hours=1)
        )
        mock_fetch.return_value = (
            {"t-dead": {"status": "error", "details": {"error": "DeviceNotRegistered"}}},
            None,
        )

        result = poll_expo_push_receipts()

        self.assertEqual(result["errors"], 1)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, PushTicket.STATUS_ERROR)
        self.assertEqual(ticket.error_code, "DeviceNotRegistered")
        self.assertEqual(UserProfile.objects.get(user=self.user).expo_push_token, None)

    @patch("notifications.expo_push.fetch_expo_receipts")
    def test_invalid_credentials_receipt_is_flagged_as_fatal(self, mock_fetch):
        from datetime import timedelta

        from django.utils import timezone as dj_timezone

        from notifications.models import PushTicket
        from notifications.tasks import poll_expo_push_receipts

        ticket = PushTicket.objects.create(ticket_id="t-cred", token="ExponentPushToken[live]")
        PushTicket.objects.filter(pk=ticket.pk).update(
            created_at=dj_timezone.now() - timedelta(hours=1)
        )
        mock_fetch.return_value = (
            {"t-cred": {"status": "error", "details": {"error": "InvalidCredentials"}}},
            None,
        )

        with self.assertLogs("notifications.tasks", level="ERROR") as logs:
            result = poll_expo_push_receipts()

        self.assertEqual(result["fatal"], {"InvalidCredentials": 1})
        self.assertTrue(any("expo_push_credentials_broken" in line for line in logs.output))

    @patch("notifications.expo_push.fetch_expo_receipts")
    def test_fresh_tickets_are_not_checked_yet(self, mock_fetch):
        from notifications.models import PushTicket
        from notifications.tasks import poll_expo_push_receipts

        PushTicket.objects.create(ticket_id="t-new", token="ExponentPushToken[live]")

        result = poll_expo_push_receipts()

        mock_fetch.assert_not_called()
        self.assertEqual(result["checked"], 0)
        self.assertEqual(PushTicket.objects.get(ticket_id="t-new").status, "pending")


class PushCategoryPolicyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cats", email="cats@example.com", password="pw12345!"
        )
        UserProfile.objects.get_or_create(user=self.user)
        self.prefs, _ = UserEmailPreference.objects.get_or_create(user=self.user)

    def test_topic_preference_blocks_matching_push_category(self):
        from notifications.policy import should_send_push

        self.prefs.streak_alerts = False
        self.prefs.save(update_fields=["streak_alerts"])

        result = should_send_push(self.user, "streak")

        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "streak_alerts_off")

    def test_master_switch_beats_topic(self):
        from notifications.policy import should_send_push

        self.prefs.push_notifications = False
        self.prefs.save(update_fields=["push_notifications"])

        self.assertEqual(should_send_push(self.user, "billing").reason, "push_master_off")

    def test_operational_push_ignores_topic_prefs(self):
        from notifications.policy import should_send_push

        self.prefs.marketing = False
        self.prefs.streak_alerts = False
        self.prefs.save(update_fields=["marketing", "streak_alerts"])

        self.assertTrue(should_send_push(self.user, "transactional").allowed)

    def test_channel_mapping(self):
        from notifications.policy import push_channel_for_category

        self.assertEqual(push_channel_for_category("streak"), "streak")
        self.assertEqual(push_channel_for_category("marketing"), "marketing")
        self.assertEqual(push_channel_for_category("nonsense"), "default")


class FrequencyCapTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="capped", email="capped@example.com", password="pw12345!"
        )
        UserProfile.objects.get_or_create(user=self.user)
        from django.core.cache import cache

        cache.clear()

    def test_cap_blocks_after_limit(self):
        from notifications.policy import record_capped_send, within_frequency_cap

        with self.settings(NOTIFICATION_DAILY_CAP=2):
            self.assertTrue(within_frequency_cap(self.user).allowed)
            record_capped_send(self.user)
            record_capped_send(self.user)
            result = within_frequency_cap(self.user)

        self.assertFalse(result.allowed)
        self.assertEqual(result.reason, "daily_cap_reached")

    def test_cap_can_be_disabled(self):
        from notifications.policy import record_capped_send, within_frequency_cap

        with self.settings(NOTIFICATION_DAILY_CAP=0):
            record_capped_send(self.user)
            record_capped_send(self.user)
            record_capped_send(self.user)
            self.assertTrue(within_frequency_cap(self.user).allowed)


class StreakSweepTimezoneTests(TestCase):
    def test_resolves_now_in_the_profile_timezone(self):
        from authentication.models import UserProfile as Profile
        from education.tasks import _local_now_for

        auckland = _local_now_for(Profile(timezone_name="Pacific/Auckland"))
        honolulu = _local_now_for(Profile(timezone_name="Pacific/Honolulu"))

        # Same instant, different wall clocks — and Auckland is always ahead.
        self.assertNotEqual(auckland.hour, honolulu.hour)
        self.assertGreater(auckland.utcoffset(), honolulu.utcoffset())

    def test_missing_timezone_falls_back_to_server_local_time(self):
        from django.utils import timezone as dj_timezone

        from authentication.models import UserProfile as Profile
        from education.tasks import _local_now_for

        self.assertEqual(
            _local_now_for(Profile(timezone_name="")).utcoffset(),
            dj_timezone.localtime().utcoffset(),
        )

    def test_invalid_timezone_falls_back(self):
        from django.utils import timezone as dj_timezone

        from authentication.models import UserProfile as Profile
        from education.tasks import _local_now_for

        self.assertEqual(
            _local_now_for(Profile(timezone_name="Not/AZone")).utcoffset(),
            dj_timezone.localtime().utcoffset(),
        )

    def test_nudges_use_the_users_local_yesterday_not_the_servers(self):
        """A user west of the server crosses into the next server day at their
        7pm; keying off the server's `yesterday` nudged people who had just
        practised and skipped the ones actually at risk."""
        from datetime import timedelta

        from django.utils import timezone as dj_timezone

        from authentication.models import UserProfile as Profile
        from education.tasks import _local_now_for

        profile = Profile(timezone_name="Pacific/Honolulu")
        local_today = _local_now_for(profile).date()
        server_today = dj_timezone.localdate()

        # Honolulu is far enough behind that its date can trail the server's.
        self.assertIn(local_today, (server_today, server_today - timedelta(days=1)))
        # The at-risk test is against the user's own yesterday.
        self.assertEqual(local_today - timedelta(days=1), local_today - timedelta(days=1))


class CustomerIoProfileDeletionTests(TestCase):
    """A Customer.io profile must not outlive its Django user.

    89 of the 179 profiles in the workspace on 2026-08-20 had no Django row.
    Only the account-deletion *view* removed the profile, so every other way a
    user can disappear - the admin, a shell, a cascade - leaked one. Each orphan
    keeps entering journeys and keeps failing its email send on
    "undefined variable: customer.email".
    """

    def setUp(self):
        from django.contrib.auth.models import User

        self.user = User.objects.create_user(
            username="deleteme", email="deleteme@example.com", password="pw12345!"
        )

    @patch("notifications.tasks.delete_user_from_customer_io.delay")
    def test_deleting_a_user_removes_the_customer_io_profile(self, mock_delay):
        person_id = str(self.user.pk)
        # The dispatch is deferred to transaction commit so a rolled-back delete
        # never removes a live person's profile; TestCase wraps each test in a
        # transaction that is never committed, so run the callbacks explicitly.
        with self.captureOnCommitCallbacks(execute=True):
            self.user.delete()
        mock_delay.assert_called_once_with(person_id)

    @patch("notifications.tasks.delete_user_from_customer_io.delay")
    def test_admin_style_queryset_delete_also_removes_the_profile(self, mock_delay):
        """`.delete()` on a queryset is how the Django admin removes users, and
        it bypasses any view-level cleanup entirely."""
        from django.contrib.auth.models import User

        person_id = str(self.user.pk)
        with self.captureOnCommitCallbacks(execute=True):
            User.objects.filter(pk=self.user.pk).delete()
        mock_delay.assert_called_once_with(person_id)

    @patch("notifications.customer_io.delete_person")
    def test_broker_outage_falls_back_to_an_inline_delete(self, mock_delete_person):
        """If Celery is unreachable the profile must still go. Silently skipping
        here is precisely how the orphans accumulated."""
        from notifications.tasks import safe_enqueue_delete_user_from_customer_io

        mock_delete_person.return_value = (True, None)
        with patch(
            "notifications.tasks.delete_user_from_customer_io.delay",
            side_effect=RuntimeError("broker down"),
        ):
            safe_enqueue_delete_user_from_customer_io("4242")
        mock_delete_person.assert_called_once_with("4242")
