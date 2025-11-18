import logging
from django.urls import reverse
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
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.client.force_authenticate(user=self.user)
        self.path = Path.objects.create(title="Test Path", description="...")
        self.course = Course.objects.create(title="Test Course", description="...", path=self.path)
        self.lesson = Lesson.objects.create(course=self.course, title="Test Lesson", detailed_content="...")

class UserLoginTest(APITestCase):
    """Test case for user login functionality, ensuring token generation works as expected."""
    def test_login(self):
        User.objects.create_user(username="testuser", password="password123")
        url = reverse('token_obtain_pair')
        data = {"username": "testuser", "password": "password123"}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        logger.info("✅ test_login passed")

class LessonCompletionTest(AuthenticatedTestCase):
    """Test case for completing a lesson and verifying the response and status."""
    def test_lesson_completion(self):
        url = reverse('userprogress-complete')
        data = {"lesson_id": self.lesson.id}
        response = self.client.post(url, data, format='json')
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
            points_reward=50
        )
        MissionCompletion.objects.create(user=self.user, mission=mission, progress=0)
        url = reverse('userprogress-complete')
        data = {"lesson_id": self.lesson.id}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 200)
        updated = MissionCompletion.objects.get(user=self.user, mission=mission)
        self.assertEqual(updated.status, "completed")
        self.assertEqual(updated.progress, 100)
        logger.info("✅ test_mission_completion_progress passed")

class ReferralTest(AuthenticatedTestCase):
    """Test case for referral submission, ensuring referral codes are applied successfully."""
    def test_referral_submission(self):
        referrer = User.objects.create_user(username='referrer', password='pass123')
        referrer_profile = referrer.userprofile
        referral_code = referrer_profile.referral_code
        response = self.client.post('/api/referrals/', {"referral_code": referral_code}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn("Referral applied successfully", response.data["message"])
        logger.info("✅ test_referral_submission passed")

class PaymentVerificationTest(AuthenticatedTestCase):
    """Test case for verifying payment sessions, ensuring successful payments are verified."""
    def test_payment_verification_success(self):
        session_id = "cs_test_valid123456789"
        with patch('stripe.checkout.Session.retrieve') as mock_retrieve:
            mock_intent = Mock(id="pi_test_123")
            mock_retrieve.return_value = Mock(payment_status="paid", payment_intent=mock_intent)
            response = self.client.post('/api/verify-session/', {"session_id": session_id}, format='json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["status"], "verified")
            logger.info("✅ test_payment_verification_success passed")

