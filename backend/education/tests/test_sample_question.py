"""Public guest-taste sample question exposure (UX Phase 3, plan §3.1).

The teaser (with correct_index + explanation) is exposed on the public detail
endpoint only for public lessons that carry one; the list endpoint exposes only
a boolean, and private lessons never appear at all.
"""

from django.urls import reverse
from rest_framework.test import APITestCase

from education.models import Course, Lesson, Path

SAMPLE = {
    "question": "What is a budget?",
    "options": ["A spending plan", "A loan", "A tax", "A stock"],
    "correct_index": 0,
    "explanation": "A budget is simply a plan for your money.",
}


class SampleQuestionPublicExposureTests(APITestCase):
    def setUp(self):
        path = Path.objects.create(title="Budgeting", description="Test path")
        self.course = Course.objects.create(path=path, title="Budgeting", description="")
        self.public_with = Lesson.objects.create(
            course=self.course,
            title="Public With Sample",
            detailed_content="Body",
            is_public=True,
            sample_question=SAMPLE,
        )
        self.public_without = Lesson.objects.create(
            course=self.course,
            title="Public Without Sample",
            detailed_content="Body",
            is_public=True,
        )
        self.private_with = Lesson.objects.create(
            course=self.course,
            title="Private With Sample",
            detailed_content="Body",
            is_public=False,
            sample_question=SAMPLE,
        )

    def test_detail_exposes_sample_question_when_set_and_public(self):
        resp = self.client.get(reverse("public-lesson-detail", args=[self.public_with.slug]))
        self.assertEqual(resp.status_code, 200)
        sq = resp.data["sample_question"]
        self.assertEqual(sq["question"], SAMPLE["question"])
        self.assertEqual(sq["options"], SAMPLE["options"])
        # correct_index + explanation are intentionally exposed for client checking.
        self.assertEqual(sq["correct_index"], 0)
        self.assertEqual(sq["explanation"], SAMPLE["explanation"])

    def test_detail_omits_sample_question_when_unset(self):
        resp = self.client.get(reverse("public-lesson-detail", args=[self.public_without.slug]))
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("sample_question", resp.data)

    def test_private_lesson_never_served(self):
        # A private lesson is 404 regardless of a set sample_question.
        resp = self.client.get(reverse("public-lesson-detail", args=[self.private_with.slug]))
        self.assertEqual(resp.status_code, 404)

    def test_list_exposes_only_boolean(self):
        resp = self.client.get(reverse("public-lesson-list"))
        self.assertEqual(resp.status_code, 200)
        by_slug = {item["slug"]: item for item in resp.data["results"]}
        # Private lesson absent; publics carry has_sample_question and no answer.
        self.assertNotIn(self.private_with.slug, by_slug)
        self.assertTrue(by_slug[self.public_with.slug]["has_sample_question"])
        self.assertFalse(by_slug[self.public_without.slug]["has_sample_question"])
        self.assertNotIn("sample_question", by_slug[self.public_with.slug])
