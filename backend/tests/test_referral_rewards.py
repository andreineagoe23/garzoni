from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from authentication.models import Referral
from authentication.services.referral_rewards import (
    REFERRAL_SIGNUP_POINTS_REFEREE,
    REFERRAL_SIGNUP_POINTS_REFERRER,
    maybe_earn_referral_reward,
)
from authentication.services.referrals import ReferralError, apply_referral, try_apply_referral_code
from tests.test_api import AuthenticatedTestCase


class ReferralApplyServiceTest(TestCase):
    def test_second_referral_from_same_referrer_succeeds(self):
        referrer = User.objects.create_user(username="ref-a", password="unit-test-password!")
        referee1 = User.objects.create_user(username="ref-b", password="unit-test-password!")
        referee2 = User.objects.create_user(username="ref-c", password="unit-test-password!")

        apply_referral(referrer.profile, referee1)
        apply_referral(referrer.profile, referee2)

        self.assertEqual(Referral.objects.filter(referrer=referrer).count(), 2)

    def test_self_referral_blocked(self):
        user = User.objects.create_user(
            username="self-ref", password="unit-test-password!", email="self@example.com"
        )
        with self.assertRaises(ReferralError):
            apply_referral(user.profile, user)

    def test_canonical_signup_points(self):
        referrer = User.objects.create_user(username="pts-ref", password="unit-test-password!")
        referee = User.objects.create_user(username="pts-new", password="unit-test-password!")
        referrer.profile.refresh_from_db()
        start_referrer_pts = referrer.profile.points
        start_referee_pts = referee.profile.points

        apply_referral(referrer.profile, referee)

        referrer.profile.refresh_from_db()
        referee.profile.refresh_from_db()
        self.assertEqual(
            referrer.profile.points, start_referrer_pts + REFERRAL_SIGNUP_POINTS_REFERRER
        )
        self.assertEqual(referee.profile.points, start_referee_pts + REFERRAL_SIGNUP_POINTS_REFEREE)


@override_settings(
    STRIPE_SECRET_KEY="sk_test_x",
    STRIPE_REFERRAL_COUPON_ID="coupon_test_50",
)
class ReferralEarnTest(TestCase):
    @patch("authentication.services.referral_rewards.stripe.PromotionCode.create")
    def test_earn_creates_promo_codes_once(self, mock_create):
        mock_create.side_effect = [
            MagicMock(code="GZREF1", id="promo_ref"),
            MagicMock(code="GZNEW1", id="promo_new"),
        ]

        referrer = User.objects.create_user(
            username="earn-ref", password="unit-test-password!", email="ref@example.com"
        )
        referee = User.objects.create_user(
            username="earn-new", password="unit-test-password!", email="new@example.com"
        )
        apply_referral(referrer.profile, referee)

        from education.models import Course, Lesson, LessonCompletion, UserProgress

        course = Course.objects.create(title="Intro", description="Test course")
        lesson = Lesson.objects.create(course=course, title="L1", detailed_content="Lesson body")
        progress, _ = UserProgress.objects.get_or_create(user=referee, course=course)
        LessonCompletion.objects.create(user_progress=progress, lesson=lesson)

        earned = maybe_earn_referral_reward(referee)
        self.assertTrue(earned)

        referral = Referral.objects.get(referred_user=referee)
        self.assertEqual(referral.reward_status, Referral.REWARD_STATUS_EARNED)
        self.assertEqual(referral.referrer_promo_code, "GZREF1")
        self.assertEqual(referral.referee_promo_code, "GZNEW1")

        earned_again = maybe_earn_referral_reward(referee)
        self.assertFalse(earned_again)
        self.assertEqual(mock_create.call_count, 2)


class ReferralApiTest(AuthenticatedTestCase):
    def test_get_referral_summary(self):
        referrer = User.objects.create_user(username="api-ref", password="unit-test-password!")
        response = self.client.get("/api/referrals/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["referral_code"], self.user.profile.referral_code)
        self.assertIsInstance(response.data["referrals_made"], list)

    def test_post_referral_iexact(self):
        referrer = User.objects.create_user(username="iexact-ref", password="unit-test-password!")
        code = referrer.profile.referral_code
        response = self.client.post(
            "/api/referrals/",
            {"referral_code": code.lower()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@override_settings(RECAPTCHA_DISABLED=True)
class RegistrationReferralUnifiedTest(APITestCase):
    def test_register_uses_unified_apply_referral(self):
        referrer = User.objects.create_user(username="reg-unify", password="unit-test-password!")
        code = referrer.profile.referral_code
        response = self.client.post(
            "/api/register-secure/",
            {
                "username": "reg-unify-new",
                "password": "unit-test-password!",
                "email": "unify-new@example.com",
                "first_name": "New",
                "last_name": "User",
                "referral_code": code,
                "accept_terms": True,
                "age_confirmed": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username="reg-unify-new")
        referral = Referral.objects.get(referred_user=created)
        self.assertEqual(referral.reward_status, Referral.REWARD_STATUS_PENDING)
        self.assertEqual(referral.referral_points, REFERRAL_SIGNUP_POINTS_REFERRER)
