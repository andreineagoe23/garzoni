import logging
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from unittest.mock import patch, Mock
from education.models import Course, Lesson, UserProgress, Path
from gamification.models import Mission, MissionCompletion
from authentication.models import UserProfile, Referral

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


class RegistrationReferralValidationTest(APITestCase):
    def test_register_rejects_invalid_referral_code(self):
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "new-user-invalid-ref",
                "password": "unit-test-password!",
                "email": "invalid-ref@example.com",
                "first_name": "Invalid",
                "last_name": "Referral",
                "referral_code": "NOT-REAL",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("referral_code", response.data.get("errors", {}))

    def test_register_accepts_empty_referral_code(self):
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "new-user-empty-ref",
                "password": "unit-test-password!",
                "email": "empty-ref@example.com",
                "first_name": "Empty",
                "last_name": "Referral",
                "referral_code": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new-user-empty-ref").exists())

    def test_register_with_valid_referral_code_creates_referral(self):
        referrer = User.objects.create_user(
            username="signup-referrer", password="unit-test-password!"
        )
        referrer_code = referrer.profile.referral_code
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "new-user-valid-ref",
                "password": "unit-test-password!",
                "email": "valid-ref@example.com",
                "first_name": "Valid",
                "last_name": "Referral",
                "referral_code": referrer_code.lower(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username="new-user-valid-ref")
        referral = Referral.objects.get(referred_user=created_user)
        self.assertEqual(referral.referrer_id, referrer.id)
        self.assertEqual(referral.referral_code, referrer_code)

    def test_referral_validation_endpoint(self):
        referrer = User.objects.create_user(
            username="validate-referrer", password="unit-test-password!"
        )
        code = referrer.profile.referral_code

        invalid = self.client.get("/api/referrals/validate/?code=BAD-CODE")
        self.assertEqual(invalid.status_code, status.HTTP_200_OK)
        self.assertFalse(invalid.data["valid"])

        valid = self.client.get(f"/api/referrals/validate/?code={code.lower()}")
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        self.assertTrue(valid.data["valid"])


class LoginRegisterRecaptchaMobileTest(APITestCase):
    """reCAPTCHA is required for web when configured; native apps skip via client_type/platform."""

    @override_settings(
        RECAPTCHA_DISABLED=False,
        RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture",  # pragma: allowlist secret
        RECAPTCHA_SITE_KEY="",
        RECAPTCHA_ENTERPRISE_PROJECT_ID="",
        RECAPTCHA_ENTERPRISE_API_KEY="",
    )
    def test_login_secure_requires_recaptcha_when_configured(self):
        User.objects.create_user(username="recap-user", password="unit-test-password!")
        response = self.client.post(
            "/api/login-secure/",
            {"username": "recap-user", "password": "unit-test-password!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "recaptcha_missing")

    @override_settings(
        RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture",  # pragma: allowlist secret
        RECAPTCHA_DISABLED=True,
    )
    def test_login_secure_skips_recaptcha_when_disabled(self):
        User.objects.create_user(username="recap-off-user", password="unit-test-password!")
        response = self.client.post(
            "/api/login-secure/",
            {"username": "recap-off-user", "password": "unit-test-password!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    @override_settings(RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture")  # pragma: allowlist secret
    def test_login_secure_skips_recaptcha_for_mobile_client_type(self):
        User.objects.create_user(username="mobile-login-user", password="unit-test-password!")
        response = self.client.post(
            "/api/login-secure/",
            {
                "username": "mobile-login-user",
                "password": "unit-test-password!",
                "client_type": "mobile",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    @override_settings(RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture")  # pragma: allowlist secret
    def test_login_secure_skips_recaptcha_for_mobile_platform(self):
        User.objects.create_user(username="mobile-login-plat", password="unit-test-password!")
        response = self.client.post(
            "/api/login-secure/",
            {
                "username": "mobile-login-plat",
                "password": "unit-test-password!",
                "platform": "mobile",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    @override_settings(
        RECAPTCHA_DISABLED=False,
        RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture",  # pragma: allowlist secret
        RECAPTCHA_SITE_KEY="",
        RECAPTCHA_ENTERPRISE_PROJECT_ID="",
        RECAPTCHA_ENTERPRISE_API_KEY="",
    )
    def test_register_secure_requires_recaptcha_when_configured(self):
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "recap-reg-user",
                "password": "unit-test-password!",
                "email": "recap-reg@example.com",
                "first_name": "Re",
                "last_name": "Cap",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "recaptcha_missing")

    @override_settings(RECAPTCHA_PRIVATE_KEY="recaptcha-test-fixture")  # pragma: allowlist secret
    def test_register_secure_skips_recaptcha_for_mobile(self):
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "mobile-reg-user",
                "password": "unit-test-password!",
                "email": "mobile-reg@example.com",
                "first_name": "Mobile",
                "last_name": "Reg",
                "client_type": "mobile",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="mobile-reg-user").exists())


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
                mode="payment",
                subscription=None,
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


class FinancialProfileTest(AuthenticatedTestCase):
    """GET/PUT /api/me/profile/: auth required, validation, partial update, cache invalidation."""

    def test_me_profile_get_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/me/profile/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_profile_put_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.put(
            "/api/me/profile/",
            {"timeframe": "medium", "risk_comfort": "low"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_profile_get_returns_profile(self):
        response = self.client.get("/api/me/profile/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("goal_types", response.data)
        self.assertIn("timeframe", response.data)
        self.assertIn("risk_comfort", response.data)

    def test_me_profile_put_partial_update_idempotent(self):
        data = {"timeframe": "medium", "risk_comfort": "low"}
        r1 = self.client.put("/api/me/profile/", data, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        r2 = self.client.put("/api/me/profile/", data, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data.get("timeframe"), r2.data.get("timeframe"))

    def test_me_profile_put_invalid_payload_rejected(self):
        response = self.client.put(
            "/api/me/profile/",
            {"timeframe": "x" * 100},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_profile_put_goal_types_validated(self):
        response = self.client.put(
            "/api/me/profile/",
            {"goal_types": "not-a-list"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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
