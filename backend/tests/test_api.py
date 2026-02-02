import logging
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from unittest.mock import patch, Mock
from education.models import Course, Lesson, UserProgress, Path
from gamification.models import Mission, MissionCompletion
from authentication.models import UserProfile

logger = logging.getLogger(__name__)


class AuthenticatedTestCase(APITestCase):
    """Base test case for authenticated users, setting up a user, path, course, and lesson for testing."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="unit-test-password!")
        self.client.force_authenticate(user=self.user)
        self.path = Path.objects.create(title="Test Path", description="...")
        self.course = Course.objects.create(title="Test Course", description="...", path=self.path)
        self.lesson = Lesson.objects.create(
            course=self.course, title="Test Lesson", detailed_content="..."
        )


class UserLoginTest(APITestCase):
    """Test case for user login functionality, ensuring token generation works as expected."""

    def test_login(self):
        User.objects.create_user(username="testuser", password="unit-test-password!")
        url = reverse("token_obtain_pair")
        data = {"username": "testuser", "password": "unit-test-password!"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        logger.info("✅ test_login passed")


class LessonCompletionTest(AuthenticatedTestCase):
    """Test case for completing a lesson and verifying the response and status."""

    def test_lesson_completion(self):
        url = reverse("userprogress-complete")
        data = {"lesson_id": self.lesson.id}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "Lesson completed")
        logger.info("✅ test_lesson_completion passed")


class MissionLogicTest(AuthenticatedTestCase):
    """Test case for mission completion logic, ensuring progress updates correctly."""

    def test_mission_completion_progress(self):
        mission = Mission.objects.create(
            name="Complete a lesson",
            description="Do 1 lesson",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 1},
            points_reward=50,
        )
        MissionCompletion.objects.create(user=self.user, mission=mission, progress=0)
        url = reverse("userprogress-complete")
        data = {"lesson_id": self.lesson.id}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, 200)
        updated = MissionCompletion.objects.get(user=self.user, mission=mission)
        self.assertEqual(updated.status, "completed")
        self.assertEqual(updated.progress, 100)
        logger.info("✅ test_mission_completion_progress passed")


class ReferralTest(AuthenticatedTestCase):
    """Test case for referral submission, ensuring referral codes are applied successfully."""

    def test_referral_submission(self):
        referrer = User.objects.create_user(username="referrer", password="unit-test-password!")
        referrer_profile = referrer.profile
        referral_code = referrer_profile.referral_code
        response = self.client.post(
            "/api/referrals/", {"referral_code": referral_code}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("Referral applied successfully", response.data["message"])
        logger.info("✅ test_referral_submission passed")


class PaymentVerificationTest(AuthenticatedTestCase):
    """Test case for verifying payment sessions, ensuring successful payments are verified."""

    def test_payment_verification_success(self):
        session_id = "cs_test_valid123456789"
        with patch("stripe.checkout.Session.retrieve") as mock_retrieve:
            mock_intent = Mock(id="pi_test_123")
            mock_retrieve.return_value = Mock(
                payment_status="paid",
                payment_intent=mock_intent,
                client_reference_id=str(self.user.id),
                metadata={"user_id": self.user.id},
            )
            response = self.client.post(
                "/api/verify-session/", {"session_id": session_id}, format="json"
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["status"], "verified")
            profile = UserProfile.objects.get(user=self.user)
            self.assertTrue(profile.has_paid)
            self.assertTrue(profile.is_premium)
            self.assertEqual(profile.subscription_status, "active")
            logger.info("✅ test_payment_verification_success passed")


class HeartsAndFlowStateTest(AuthenticatedTestCase):
    """Validate hearts endpoints and flow_state persistence."""

    def test_hearts_default_and_decrement(self):
        response = self.client.get("/api/user/hearts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["max_hearts"], 5)
        self.assertEqual(response.data["hearts"], 5)

        response = self.client.post("/api/user/hearts/decrement/", {"amount": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["hearts"], 4)
        self.assertIn("last_refill_at", response.data)

    def test_flow_state_roundtrip(self):
        response = self.client.get(f"/api/userprogress/flow_state/?course={self.course.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_index"], 0)

        response = self.client.post(
            "/api/userprogress/flow_state/",
            {"course": self.course.id, "current_index": 3},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_index"], 3)

        response = self.client.get(f"/api/userprogress/flow_state/?course={self.course.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_index"], 3)


class SubscriptionCreateTest(AuthenticatedTestCase):
    """Subscription create workflow: Starter rejected, Plus/Pro use Stripe checkout."""

    def test_subscription_create_rejects_starter(self):
        response = self.client.post(
            "/api/subscriptions/create/",
            {"plan_id": "starter", "billing_interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Starter", response.data.get("error", ""))

    def test_subscription_create_rejects_free_plan_id(self):
        response = self.client.post(
            "/api/subscriptions/create/",
            {"plan_id": "free", "billing_interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(STRIPE_SECRET_KEY="")
    def test_subscription_create_503_when_stripe_not_configured(self):
        response = self.client.post(
            "/api/subscriptions/create/",
            {"plan_id": "plus", "billing_interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("error", response.data)

    @patch("finance.views.stripe.checkout.Session.create")
    @override_settings(
        STRIPE_SECRET_KEY="sk_test_fake",  # pragma: allowlist secret
        STRIPE_PRICE_PLUS_MONTHLY="price_plus_123",
    )
    def test_subscription_create_plus_returns_redirect_url(self, mock_stripe_create):
        mock_stripe_create.return_value = Mock(
            id="cs_test_123", url="https://checkout.stripe.com/xxx"
        )
        response = self.client.post(
            "/api/subscriptions/create/",
            {"plan_id": "plus", "billing_interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("redirect_url"), "https://checkout.stripe.com/xxx")
        mock_stripe_create.assert_called_once()
        call_kwargs = mock_stripe_create.call_args[1]
        self.assertEqual(call_kwargs.get("mode"), "subscription")
        self.assertEqual(call_kwargs["line_items"][0]["price"], "price_plus_123")


class PlansCatalogTest(APITestCase):
    """Plans API returns catalog with personalized_path feature by tier."""

    def test_plans_include_personalized_path_feature(self):
        response = self.client.get("/api/plans/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plans = response.data.get("plans", [])
        self.assertGreater(len(plans), 0)
        by_id = {p["plan_id"]: p for p in plans}
        self.assertIn("starter", by_id)
        self.assertIn("plus", by_id)
        self.assertIn("pro", by_id)
        features = by_id.get("starter", {}).get("features", {})
        self.assertIn("personalized_path", features)
        self.assertFalse(features["personalized_path"].get("enabled"))
        plus_features = by_id.get("plus", {}).get("features", {})
        self.assertIn("personalized_path", plus_features)
        self.assertTrue(plus_features["personalized_path"].get("enabled"))
