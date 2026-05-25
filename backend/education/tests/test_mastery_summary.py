from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from education.models import (
    Course,
    Exercise,
    Lesson,
    LessonSection,
    Mastery,
    MasterySnapshot,
    Path,
    Quiz,
    UserExerciseProgress,
    UserProgress,
)
from education.views import (
    SECTION_MASTERY_BUMP,
    SECTION_MASTERY_BASELINE,
    SECTION_MASTERY_CAP,
    _complete_lesson_for_user,
    _complete_section_for_user,
    _grant_initial_mastery,
    _mastery_level_band,
    _resolve_course_for_skill,
)
from education.tasks import decay_course_mastery


class MasterySummaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("learner", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _exercise(self, category, **kwargs):
        defaults = {
            "type": "numeric",
            "question": "Sample?",
            "exercise_data": {"value": 1},
            "correct_answer": {"value": 1},
            "category": category,
            "is_published": True,
        }
        defaults.update(kwargs)
        return Exercise.objects.create(**defaults)

    def _course_with_lesson(self, path_title, lesson_title="Intro", category=None):
        path = Path.objects.create(title=path_title, description="Test path")
        course = Course.objects.create(path=path, title=path_title, description="")
        lesson = Lesson.objects.create(
            course=course,
            title=lesson_title,
            detailed_content="Lesson body",
            exercise_data={"category": category or path_title},
        )
        LessonSection.objects.create(
            lesson=lesson,
            order=1,
            title="Section 1",
            content_type="text",
            text_content="Hello",
        )
        return path, course, lesson

    def test_returns_due_first_with_review_action(self):
        now = timezone.now()
        _, budgeting_course, _ = self._course_with_lesson("Budgeting")
        _, investing_course, _ = self._course_with_lesson("Investing")
        Mastery.objects.create(
            user=self.user,
            course=budgeting_course,
            skill="Budgeting",
            proficiency=40,
            due_at=now - timedelta(days=2),
        )
        Mastery.objects.create(
            user=self.user,
            course=investing_course,
            skill="Investing",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )
        self._exercise("Budgeting")
        self._exercise("Investing")

        response = self.client.get("/api/mastery-summary/")
        self.assertEqual(response.status_code, 200)
        items = response.data["masteries"]
        self.assertEqual([i["skill"] for i in items], ["Budgeting", "Investing"])

        budgeting = items[0]
        self.assertTrue(budgeting["is_due_now"])
        self.assertEqual(budgeting["recommended_action"], "review")
        self.assertIsNotNone(budgeting["review_exercise_id"])
        self.assertGreaterEqual(budgeting["overdue_days"], 1)

        investing = items[1]
        self.assertFalse(investing["is_due_now"])
        self.assertEqual(investing["recommended_action"], "practice")
        self.assertIsNone(investing["review_exercise_id"])

    def test_delta_7d_from_snapshot(self):
        today = timezone.localdate()
        _, course, _ = self._course_with_lesson("Saving")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=60,
            due_at=timezone.now() + timedelta(days=2),
        )
        # Snapshot 5 days ago at 50 → delta should be +10.
        MasterySnapshot.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=50,
            recorded_on=today - timedelta(days=5),
        )
        # Today's snapshot written by signal upon mastery save; that is fine — earliest in window wins.

        response = self.client.get("/api/mastery-summary/")
        saving = next(i for i in response.data["masteries"] if i["skill"] == "Saving")
        self.assertEqual(saving["delta_7d"], 10)

    def test_declining_sorts_before_flat_when_no_due(self):
        today = timezone.localdate()
        now = timezone.now()
        _, flat_course, _ = self._course_with_lesson("Flat")
        _, declining_course, _ = self._course_with_lesson("Declining")
        # Both not due.
        Mastery.objects.create(
            user=self.user,
            course=flat_course,
            skill="Flat",
            proficiency=50,
            due_at=now + timedelta(days=3),
        )
        Mastery.objects.create(
            user=self.user,
            course=declining_course,
            skill="Declining",
            proficiency=50,
            due_at=now + timedelta(days=3),
        )
        # Older snapshot for Declining at 70 → delta_7d = -20 → ranks first.
        MasterySnapshot.objects.create(
            user=self.user,
            course=declining_course,
            skill="Declining",
            proficiency=70,
            recorded_on=today - timedelta(days=5),
        )

        response = self.client.get("/api/mastery-summary/")
        skills = [i["skill"] for i in response.data["masteries"]]
        self.assertEqual(skills, ["Declining", "Flat"])

    def test_weakness_score_ranks_low_practice_above_equal_proficiency(self):
        now = timezone.now()
        _, budgeting_course, _ = self._course_with_lesson("Budgeting")
        _, investing_course, _ = self._course_with_lesson("Investing")
        Mastery.objects.create(
            user=self.user,
            course=budgeting_course,
            skill="Budgeting",
            proficiency=12,
            due_at=now + timedelta(days=3),
        )
        Mastery.objects.create(
            user=self.user,
            course=investing_course,
            skill="Investing",
            proficiency=12,
            due_at=now + timedelta(days=3),
        )
        budgeting_ex = self._exercise("Budgeting")
        investing_ex = self._exercise("Investing")
        # More practice on Investing → lower weakness priority than barely-touched Budgeting.
        UserExerciseProgress.objects.create(
            user=self.user, exercise=budgeting_ex, attempts=1, completed=True
        )
        UserExerciseProgress.objects.create(
            user=self.user, exercise=investing_ex, attempts=8, completed=True
        )

        response = self.client.get("/api/mastery-summary/")
        items = response.data["masteries"]
        self.assertEqual(items[0]["skill"], "Budgeting")
        self.assertGreater(items[0]["weakness_score"], items[1]["weakness_score"])

    def test_weakness_score_field_present(self):
        now = timezone.now()
        _, course, _ = self._course_with_lesson("Saving")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=30,
            due_at=now + timedelta(days=2),
        )
        response = self.client.get("/api/mastery-summary/")
        saving = response.data["masteries"][0]
        self.assertIn("weakness_score", saving)
        self.assertIsInstance(saving["weakness_score"], (int, float))
        self.assertGreater(saving["weakness_score"], 0)

    def test_next_step_review_when_due(self):
        now = timezone.now()
        _, course, _ = self._course_with_lesson("Budgeting")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Budgeting",
            proficiency=20,
            due_at=now - timedelta(days=1),
        )
        self._exercise("Budgeting")

        response = self.client.get("/api/mastery-summary/")
        budgeting = next(i for i in response.data["masteries"] if i["skill"] == "Budgeting")
        self.assertEqual(budgeting["next_step"]["type"], "review")
        self.assertIsNotNone(budgeting["next_step"]["target_id"])

    def test_next_step_prefers_lesson_over_quiz_and_practice(self):
        now = timezone.now()
        _, course, lesson = self._course_with_lesson("Saving", lesson_title="Save More")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )
        Quiz.objects.create(
            course=course,
            title="Saving quiz",
            question="What is saving?",
            choices=["A", "B"],
            correct_answer="A",
        )
        self._exercise("Saving")

        response = self.client.get("/api/mastery-summary/")
        saving = next(i for i in response.data["masteries"] if i["skill"] == "Saving")
        self.assertEqual(saving["next_step"]["type"], "lesson")
        self.assertEqual(saving["next_step"]["target_id"], lesson.id)
        self.assertEqual(saving["next_step"]["course_id"], course.id)

    def test_next_step_falls_back_to_quiz_when_no_lessons_remain(self):
        now = timezone.now()
        _, course, lesson = self._course_with_lesson("Investing", lesson_title="Basics")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Investing",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )
        progress, _ = UserProgress.objects.get_or_create(user=self.user, course=course)
        progress.completed_lessons.add(lesson)
        quiz = Quiz.objects.create(
            course=course,
            title="Investing quiz",
            question="What is investing?",
            choices=["A", "B"],
            correct_answer="A",
        )
        self._exercise("Investing")

        response = self.client.get("/api/mastery-summary/")
        investing = next(i for i in response.data["masteries"] if i["skill"] == "Investing")
        self.assertEqual(investing["next_step"]["type"], "quiz")
        self.assertEqual(investing["next_step"]["target_id"], quiz.id)

    def test_next_step_practice_when_only_exercises_available(self):
        now = timezone.now()
        _, course, lesson = self._course_with_lesson("Taxes")
        progress, _ = UserProgress.objects.get_or_create(user=self.user, course=course)
        progress.completed_lessons.add(lesson)
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Taxes",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )
        exercise = self._exercise("Taxes")

        response = self.client.get("/api/mastery-summary/")
        taxes = next(i for i in response.data["masteries"] if i["skill"] == "Taxes")
        self.assertEqual(taxes["next_step"]["type"], "practice")
        self.assertEqual(taxes["next_step"]["target_id"], exercise.id)

    def test_next_step_tutor_when_no_content_available(self):
        now = timezone.now()
        path = Path.objects.create(title="Orphan", description="Test path")
        course = Course.objects.create(path=path, title="OrphanSkill", description="")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="OrphanSkill",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )

        response = self.client.get("/api/mastery-summary/")
        orphan = next(i for i in response.data["masteries"] if i["skill"] == "OrphanSkill")
        self.assertEqual(orphan["next_step"]["type"], "tutor")
        self.assertIsNone(orphan["next_step"]["target_id"])

    def test_section_completion_accumulates_proficiency(self):
        """Repeated section completions in a skill bump proficiency past the initial 12%."""
        _, course, _ = self._course_with_lesson("Saving")
        _grant_initial_mastery(self.user, "Saving", course=course)
        mastery = Mastery.objects.get(user=self.user, course=course)
        self.assertEqual(mastery.proficiency, SECTION_MASTERY_BASELINE)
        first_due = mastery.due_at

        for _ in range(5):
            _grant_initial_mastery(self.user, "Saving", course=course)

        mastery.refresh_from_db()
        self.assertEqual(mastery.proficiency, SECTION_MASTERY_BASELINE + 5 * SECTION_MASTERY_BUMP)
        self.assertGreaterEqual(mastery.due_at, first_due)

    def test_section_completion_caps_proficiency(self):
        """Sections alone cannot push proficiency past the section-only cap (40)."""
        _, course, _ = self._course_with_lesson("Investing")
        _grant_initial_mastery(self.user, "Investing", course=course)
        for _ in range(50):
            _grant_initial_mastery(self.user, "Investing", course=course)

        mastery = Mastery.objects.get(user=self.user, course=course)
        self.assertEqual(mastery.proficiency, SECTION_MASTERY_CAP)

    def test_section_completion_refreshes_due_at(self):
        """due_at advances on every section completion so active learners don't drift overdue."""
        _, course, _ = self._course_with_lesson("Taxes")
        mastery = Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Taxes",
            proficiency=12,
            due_at=timezone.now() - timedelta(days=20),
        )
        _grant_initial_mastery(self.user, "Taxes", course=course)
        mastery.refresh_from_db()
        self.assertGreater(mastery.due_at, timezone.now())

    def test_section_completion_does_not_demote_high_proficiency(self):
        """High proficiency from exercises is preserved; sections only extend due_at."""
        _, course, _ = self._course_with_lesson("Advanced")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Advanced",
            proficiency=85,
            due_at=timezone.now() + timedelta(days=2),
        )
        _grant_initial_mastery(self.user, "Advanced", course=course)
        mastery = Mastery.objects.get(user=self.user, course=course)
        self.assertEqual(mastery.proficiency, 85)

    def test_snapshot_signal_writes_one_row_per_day(self):
        _, course, _ = self._course_with_lesson("Taxes")
        m = Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Taxes",
            proficiency=30,
            due_at=timezone.now() + timedelta(days=1),
        )
        m.proficiency = 45
        m.save()
        m.proficiency = 55
        m.save()
        snaps = MasterySnapshot.objects.filter(user=self.user, course=course)
        self.assertEqual(snaps.count(), 1)
        # Latest save value persisted.
        self.assertEqual(snaps.first().proficiency, 55)

    def test_section_completion_routes_mastery_to_course(self):
        _, course, lesson = self._course_with_lesson("Budgeting")
        section = lesson.sections.first()

        _complete_section_for_user(self.user, section)

        mastery = Mastery.objects.get(user=self.user, course=course)
        self.assertEqual(mastery.skill, "Budgeting")
        self.assertGreaterEqual(mastery.proficiency, SECTION_MASTERY_BASELINE)

    def test_crypto_alias_resolves_to_crypto_course(self):
        path = Path.objects.create(title="Crypto", description="Test path")
        course = Course.objects.create(path=path, title="Crypto", description="")

        resolved = _resolve_course_for_skill("Cryptocurrency")

        self.assertEqual(resolved, course)

    def test_bulk_lesson_completion_credits_all_sections(self):
        path = Path.objects.create(title="Compound Interest", description="Test path")
        course = Course.objects.create(path=path, title="Compound Interest", description="")
        lesson = Lesson.objects.create(
            course=course,
            title="Growth",
            detailed_content="Lesson body",
            exercise_data={"category": "Compound Interest"},
        )
        for idx in range(1, 5):
            LessonSection.objects.create(
                lesson=lesson,
                order=idx,
                title=f"Section {idx}",
                content_type="text",
                text_content="Hello",
            )

        _complete_lesson_for_user(self.user, lesson)

        mastery = Mastery.objects.get(user=self.user, course=course)
        self.assertEqual(
            mastery.proficiency,
            min(SECTION_MASTERY_CAP, SECTION_MASTERY_BASELINE + 3 * SECTION_MASTERY_BUMP),
        )

    def test_mastery_level_boundaries(self):
        expectations = {
            0: "not_started",
            29: "attempted",
            30: "familiar",
            69: "familiar",
            70: "proficient",
            94: "proficient",
            95: "mastered",
        }
        for value, band in expectations.items():
            with self.subTest(value=value):
                self.assertEqual(_mastery_level_band(value), band)

    def test_decay_respects_completed_content_floor(self):
        _, course, lesson = self._course_with_lesson("Saving")
        progress, _ = UserProgress.objects.get_or_create(user=self.user, course=course)
        progress.completed_lessons.add(lesson)
        old = timezone.now() - timedelta(days=20)
        mastery = Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=80,
            due_at=old,
        )
        Mastery.objects.filter(pk=mastery.pk).update(last_reviewed=old)

        decay_course_mastery()

        mastery.refresh_from_db()
        self.assertGreaterEqual(mastery.proficiency, 40)
        self.assertLess(mastery.proficiency, 80)

    def test_next_step_not_tutor_when_course_has_content(self):
        now = timezone.now()
        _, course, lesson = self._course_with_lesson("Emergency Fund")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Emergency Fund",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )

        response = self.client.get("/api/mastery-summary/")
        item = next(i for i in response.data["masteries"] if i["course_id"] == course.id)
        self.assertNotEqual(item["next_step"]["type"], "tutor")
        self.assertEqual(item["next_step"]["target_id"], lesson.id)

    def test_whats_next_prefers_due_reviews(self):
        now = timezone.now()
        _, course, _ = self._course_with_lesson("Budgeting")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Budgeting",
            proficiency=40,
            due_at=now - timedelta(days=1),
        )
        exercise = self._exercise("Budgeting")

        response = self.client.get("/api/whats-next/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["type"], "review")
        self.assertEqual(response.data["source"], "review_queue")
        self.assertIn(f"exerciseId={exercise.id}", response.data["action_route"])

    def test_whats_next_uses_mastery_next_step(self):
        now = timezone.now()
        _, course, lesson = self._course_with_lesson("Saving", lesson_title="Save More")
        Mastery.objects.create(
            user=self.user,
            course=course,
            skill="Saving",
            proficiency=20,
            due_at=now + timedelta(days=3),
        )

        response = self.client.get("/api/whats-next/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["type"], "lesson")
        self.assertEqual(response.data["source"], "mastery_summary")
        self.assertEqual(response.data["course_id"], course.id)
        self.assertIn(f"lessonId={lesson.id}", response.data["action_route"])

    def test_whats_next_falls_back_to_resume(self):
        _, course, _ = self._course_with_lesson("Investing")
        UserProgress.objects.create(
            user=self.user,
            course=course,
            flow_current_index=2,
        )

        response = self.client.get("/api/whats-next/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["type"], "resume")
        self.assertEqual(response.data["source"], "progress_summary")
        self.assertEqual(response.data["action_route"], f"/flow/{course.id}")
