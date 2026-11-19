"""Lesson order and the flow's Finish action (growth audit 2026-11 §3.1).

Postgres returned course 22's lessons with the real first lesson last, so onboarding's
deep link landed on the "last" lesson and Finish bulk-completed the whole course.
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from education.models import Course, Lesson, LessonSection, Path, UserProgress


class CourseCompletionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="finish-user", email="finish@example.com", password="pass12345"
        )
        path = Path.objects.create(title="Budgeting", description="Test path")
        self.course = Course.objects.create(path=path, title="Budgeting", description="")
        self.lessons = [
            Lesson.objects.create(course=self.course, title=f"Lesson {n}", detailed_content="Body")
            for n in range(1, 4)
        ]
        self.sections = {
            lesson.id: [
                LessonSection.objects.create(lesson=lesson, order=i, title=f"S{i}")
                for i in range(1, 4)
            ]
            for lesson in self.lessons
        }
        self.client.force_authenticate(user=self.user)

    def _complete_section(self, section):
        return self.client.post(
            reverse("userprogress-complete-section"), {"section_id": section.id}, format="json"
        )

    def _finish(self):
        return self.client.post(
            reverse("userprogress-complete-course"), {"course_id": self.course.id}, format="json"
        )

    def _completed_ids(self):
        progress = UserProgress.objects.get(user=self.user, course=self.course)
        return set(progress.completed_sections.values_list("id", flat=True))

    def test_lessons_come_back_in_id_order_after_an_update(self):
        # A non-HOT UPDATE (an indexed column changes) gives the row a new heap and
        # index position, which is what put the real first lesson last in production.
        first = self.lessons[0]
        first.slug = f"{first.slug}-edited"
        first.save()

        resp = self.client.get(reverse("lesson-with-progress"), {"course": self.course.id})

        self.assertEqual(resp.status_code, 200)
        self.assertEqual([row["id"] for row in resp.data], [lesson.id for lesson in self.lessons])

    def test_finish_after_one_lesson_does_not_complete_the_course(self):
        for section in self.sections[self.lessons[0].id]:
            self._complete_section(section)

        resp = self._finish()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._completed_ids(), {s.id for s in self.sections[self.lessons[0].id]})
        progress = UserProgress.objects.get(user=self.user, course=self.course)
        self.assertFalse(progress.is_course_complete)

    def test_finish_fills_skipped_sections_in_started_lessons(self):
        for lesson in self.lessons:
            self._complete_section(self.sections[lesson.id][0])

        self._finish()

        all_ids = {s.id for sections in self.sections.values() for s in sections}
        self.assertEqual(self._completed_ids(), all_ids)
        progress = UserProgress.objects.get(user=self.user, course=self.course)
        self.assertTrue(progress.is_course_complete)
