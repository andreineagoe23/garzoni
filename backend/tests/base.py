"""
Base test utilities and classes for all test suites.
"""

from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from education.models import Path, Course, Lesson, LessonSection
from authentication.models import UserProfile
from gamification.models import Badge, Mission
from finance.models import FinanceFact, Reward
import logging

logger = logging.getLogger(__name__)


class BaseTestCase(APITestCase):
    """Base test case with common setup for all tests."""

    def setUp(self):
        """Set up test data that's commonly used across tests."""
        # Create test users
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123!",  # pragma: allowlist secret
        )
        self.user2 = User.objects.create_user(
            username="testuser2",
            email="test2@example.com",
            password="testpass123!",  # pragma: allowlist secret
        )
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="adminpass123!",  # pragma: allowlist secret
            is_staff=True,
            is_superuser=True,
        )

        # Get or create user profiles (they may be created by signals)
        self.user_profile, _ = UserProfile.objects.get_or_create(
            user=self.user,
            defaults={
                "referral_code": "TEST123",
                "points": 100,
                "hearts": 5,
            },
        )
        # Update if already exists
        if not self.user_profile.referral_code:
            self.user_profile.referral_code = "TEST123"
        if self.user_profile.points == 0:
            self.user_profile.points = 100
        if self.user_profile.hearts == 0:
            self.user_profile.hearts = 5
        self.user_profile.save()

        self.user2_profile, _ = UserProfile.objects.get_or_create(
            user=self.user2,
            defaults={
                "referral_code": "TEST456",
                "points": 50,
            },
        )
        # Update if already exists
        if not self.user2_profile.referral_code:
            self.user2_profile.referral_code = "TEST456"
        if self.user2_profile.points == 0:
            self.user2_profile.points = 50
        self.user2_profile.save()

        # Create test path and course
        self.path = Path.objects.create(
            title="Test Path",
            description="A test learning path",
        )
        self.course = Course.objects.create(
            path=self.path,
            title="Test Course",
            description="A test course",
            is_active=True,
            order=1,
        )
        self.lesson = Lesson.objects.create(
            course=self.course,
            title="Test Lesson",
            short_description="A test lesson",
            detailed_content="<p>Test content</p>",
        )

    def authenticate_user(self, user=None):
        """Helper to authenticate a user for API requests."""
        user = user or self.user
        self.client.force_authenticate(user=user)

    def authenticate_admin(self):
        """Helper to authenticate admin user."""
        self.client.force_authenticate(user=self.admin_user)


class AuthenticatedTestCase(BaseTestCase):
    """Test case for authenticated endpoints."""

    def setUp(self):
        super().setUp()
        self.authenticate_user()
