from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Course, UserProgress, Path, Lesson


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
        User.objects.create_user(username="testuser", password="password123")
        url = reverse('login')
        data = {"username": "testuser", "password": "password123"}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)


class UserProgressTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.client.force_authenticate(user=self.user)

        self.path = Path.objects.create(title="Finance Path", description="Beginner level")
        self.course = Course.objects.create(title="Intro to Forex", description="Forex basics", path=self.path)
        self.lesson1 = Lesson.objects.create(title="Lesson 1", course=self.course, detailed_content="Test content")

    def test_create_user_progress(self):
        url = reverse('userprogress-list')
        response = self.client.post(url, {
            "course": self.course.id,
            "is_course_complete": False
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserProgress.objects.count(), 1)
        progress = UserProgress.objects.get()
        progress.completed_lessons.set([self.lesson1])
        self.assertEqual(progress.user, self.user)

    def test_get_user_progress(self):
        progress = UserProgress.objects.create(user=self.user, course=self.course, is_course_complete=False)
        progress.completed_lessons.set([self.lesson1])

        url = reverse('userprogress-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_update_user_progress(self):
        progress = UserProgress.objects.create(user=self.user, course=self.course, is_course_complete=False)
        progress.completed_lessons.set([self.lesson1])

        url = reverse('userprogress-detail', args=[progress.id])
        response = self.client.patch(url, {
            "is_course_complete": True
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress.refresh_from_db()
        self.assertTrue(progress.is_course_complete)

    def test_delete_user_progress(self):
        progress = UserProgress.objects.create(user=self.user, course=self.course, is_course_complete=False)
        progress.completed_lessons.set([self.lesson1])

        url = reverse('userprogress-detail', args=[progress.id])
        response = self.client.delete(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(UserProgress.objects.count(), 0)
