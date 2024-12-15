# core/tests.py

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Course, UserProgress, Path

class UserTests(APITestCase):
    def test_user_registration(self):
        url = reverse('register')
        data = {
            "username": "testuser",
            "password": "password123",
            "email": "testuser@example.com",
            "first_name": "Test",
            "last_name": "User"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().username, "testuser")

    def test_user_login(self):
        # First, register the user
        user = User.objects.create_user(username="testuser", password="password123")
        url = reverse('login')
        data = {"username": "testuser", "password": "password123"}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)  # Check for access token in response

class UserProgressTests(APITestCase):
    def setUp(self):
        # Create a user and authenticate
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.client.force_authenticate(user=self.user)

        # Set up data for Course and Path
        self.path = Path.objects.create(title="Finance Path", description="A beginner path for finance")
        self.course = Course.objects.create(title="Intro to Forex", description="Learn forex basics", path=self.path)
        
    def test_create_user_progress(self):
        url = reverse('userprogress-list')
        data = {
            "course": self.course.id,
            "completed_lessons": 1,
            "is_course_complete": False
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserProgress.objects.count(), 1)
        self.assertEqual(UserProgress.objects.get().user, self.user)

    def test_get_user_progress(self):
        # Create progress record
        UserProgress.objects.create(user=self.user, course=self.course, completed_lessons=1, is_course_complete=False)
        url = reverse('userprogress-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # Check we get one progress record

    def test_update_user_progress(self):
        progress = UserProgress.objects.create(user=self.user, course=self.course, completed_lessons=1, is_course_complete=False)
        url = reverse('userprogress-detail', args=[progress.id])
        data = {
            "completed_lessons": 2,
            "is_course_complete": True
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress.refresh_from_db()
        self.assertEqual(progress.completed_lessons, 2)
        self.assertTrue(progress.is_course_complete)

    def test_delete_user_progress(self):
        progress = UserProgress.objects.create(user=self.user, course=self.course, completed_lessons=1, is_course_complete=False)
        url = reverse('userprogress-detail', args=[progress.id])
        response = self.client.delete(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(UserProgress.objects.count(), 0)
