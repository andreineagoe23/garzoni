from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase
from onboarding.models import QuestionnaireVersion, QuestionnaireProgress
from authentication.models import UserProfile
from decimal import Decimal

# Test fixture (not a real secret)
TEST_USER_PASSWORD = "testpass123"  # pragma: allowlist secret


class QuestionnaireProgressTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password=TEST_USER_PASSWORD,
        )
        self.user_profile = UserProfile.objects.get(user=self.user)

        # Create questionnaire version
        self.version = QuestionnaireVersion.objects.create(
            version=2,
            is_active=True,
            questionnaire_structure={
                "sections": [
                    {
                        "id": "section1",
                        "title": "Section 1",
                        "questions": [
                            {
                                "id": "q1",
                                "type": "multiple_choice",
                                "text": "Question 1?",
                                "options": [
                                    {"value": "a", "label": "Option A"},
                                    {"value": "b", "label": "Option B"},
                                ],
                            },
                            {
                                "id": "q2",
                                "type": "multiple_choice",
                                "text": "Question 2?",
                                "options": [
                                    {"value": "c", "label": "Option C"},
                                    {"value": "d", "label": "Option D"},
                                ],
                                "skip_if": {
                                    "field": "q1",
                                    "operator": "==",
                                    "value": "a",
                                },
                            },
                        ],
                    },
                    {
                        "id": "section2",
                        "title": "Section 2",
                        "questions": [
                            {
                                "id": "q3",
                                "type": "multiple_choice",
                                "text": "Question 3?",
                                "options": [
                                    {"value": "e", "label": "Option E"},
                                    {"value": "f", "label": "Option F"},
                                ],
                            },
                        ],
                    },
                ],
            },
        )

    def test_create_progress(self):
        """Test creating questionnaire progress."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
        )
        self.assertEqual(progress.user, self.user)
        self.assertEqual(progress.version, self.version)
        self.assertEqual(progress.status, "in_progress")
        self.assertEqual(progress.current_section_index, 0)
        self.assertEqual(progress.current_question_index, 0)

    def test_progress_percentage(self):
        """Displayed progress = endowed seed + raw remapped onto the remaining band."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
            current_section_index=1,
        )
        # Version has 3 questions (2 in section1, 1 in section2). At section 1,
        # question 0 we're on question 3; answered = 2 → raw 66% → displayed
        # 15 + round(66 * 0.85) = 71 (goal-gradient seed, plan §2.2).
        self.assertEqual(progress.get_progress_percentage(), 71)

    def test_progress_percentage_seeded_before_first_answer(self):
        """First question renders at the endowed seed (15%), never 0%."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
        )
        self.assertEqual(progress.get_progress_percentage(), 15)

    def test_progress_percentage_caps_at_100(self):
        # Completion is signaled by status, not by a section/question index
        # "past" the last question (no such position exists in this model) —
        # the early-return branch must yield exactly 100, not seed + raw.
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="completed",
            current_section_index=1,
        )
        self.assertEqual(progress.get_progress_percentage(), 100)

    def test_idempotent_saving(self):
        """Test that saving the same answer twice doesn't create duplicates."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
        )

        # Save answer first time
        progress.answers["q1"] = "a"
        progress.save()

        # Save same answer again
        progress.answers["q1"] = "a"
        progress.save()

        # Should only have one answer
        self.assertEqual(progress.answers.get("q1"), "a")
        self.assertEqual(len(progress.answers), 1)

    def test_reward_granting_idempotency(self):
        """Test that rewards are only granted once."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
            completion_idempotency_key="test-key-123",
        )

        initial_points = self.user_profile.points
        initial_money = self.user_profile.earned_money

        # Complete first time
        progress.status = "completed"
        progress.completed_at = timezone.now()
        if not progress.rewards_granted:
            self.user_profile.add_points(100)
            self.user_profile.add_money(Decimal("10.00"))
            progress.rewards_granted = True
        progress.save()

        self.user_profile.refresh_from_db()
        self.assertEqual(self.user_profile.points, initial_points + 100)
        self.assertEqual(self.user_profile.earned_money, initial_money + Decimal("10.00"))

        # Try to complete again with same key
        progress.refresh_from_db()
        if progress.completion_idempotency_key == "test-key-123" and progress.rewards_granted:
            # Should not grant again
            points_before = self.user_profile.points
            money_before = self.user_profile.earned_money
            progress.save()
            self.user_profile.refresh_from_db()
            self.assertEqual(self.user_profile.points, points_before)
            self.assertEqual(self.user_profile.earned_money, money_before)

    def test_completed_sections_count(self):
        """Test completed sections count calculation."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
            current_section_index=1,
        )
        # Should be 1 (section 0 completed, on section 1)
        self.assertEqual(progress.get_completed_sections_count(), 1)

        progress.status = "completed"
        progress.save()
        # Should be 2 (both sections completed)
        self.assertEqual(progress.get_completed_sections_count(), 2)


class QuestionnaireSkipLogicTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password=TEST_USER_PASSWORD,
        )

        self.version = QuestionnaireVersion.objects.create(
            version=2,
            is_active=True,
            questionnaire_structure={
                "sections": [
                    {
                        "id": "section1",
                        "title": "Section 1",
                        "questions": [
                            {
                                "id": "experience_level",
                                "type": "multiple_choice",
                                "text": "Experience level?",
                                "options": [
                                    {"value": "beginner", "label": "Beginner"},
                                    {"value": "intermediate", "label": "Intermediate"},
                                    {"value": "advanced", "label": "Advanced"},
                                ],
                            },
                            {
                                "id": "focus_area",
                                "type": "multiple_choice",
                                "text": "Focus area?",
                                "options": [
                                    {"value": "budgeting", "label": "Budgeting"},
                                ],
                                "skip_if": {
                                    "field": "experience_level",
                                    "operator": "==",
                                    "value": "advanced",
                                },
                            },
                        ],
                    },
                ],
            },
        )

    def test_skip_condition_evaluation(self):
        """Test skip condition evaluation logic."""
        from onboarding.views import _evaluate_skip_condition

        answers = {"experience_level": "advanced"}
        condition = {
            "field": "experience_level",
            "operator": "==",
            "value": "advanced",
        }
        self.assertTrue(_evaluate_skip_condition(condition, answers))

        answers = {"experience_level": "beginner"}
        self.assertFalse(_evaluate_skip_condition(condition, answers))

    def test_skip_condition_not_equal(self):
        """Test skip condition with != operator."""
        from onboarding.views import _evaluate_skip_condition

        answers = {"experience_level": "beginner"}
        condition = {
            "field": "experience_level",
            "operator": "!=",
            "value": "advanced",
        }
        self.assertTrue(_evaluate_skip_condition(condition, answers))


class PlanSummaryEndpointTest(APITestCase):
    """GET /api/onboarding/plan-summary/ — the "Your Plan Is Ready" segue."""

    URL = "/api/onboarding/plan-summary/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="plan-summary-user",
            email="plan@example.com",
            password=TEST_USER_PASSWORD,
        )
        self.profile = UserProfile.objects.get(user=self.user)
        self.client.force_authenticate(user=self.user)

    def _make_path_with_lessons(self, access_tier="starter", num_lessons=5):
        from education.models import Path, Course, Lesson

        path = Path.objects.create(
            title="Budgeting", description="Budget basics", access_tier=access_tier
        )
        course = Course.objects.create(
            path=path, title="Budgeting basics", description="c", order=1
        )
        lessons = [
            Lesson.objects.create(course=course, title=f"Lesson {i}", detailed_content="")
            for i in range(1, num_lessons + 1)
        ]
        return path, course, lessons

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.URL)
        self.assertIn(response.status_code, (401, 403))

    def test_full_payload_shape_and_values(self):
        self.profile.goal_types = ["debt", "invest", "savings"]
        self.profile.timeframe = "6_months"
        self.profile.risk_comfort = "medium"
        self.profile.investing_experience = "advanced"
        self.profile.save()

        _, course, lessons = self._make_path_with_lessons(num_lessons=5)
        self.profile.recommended_courses = [course.id]
        self.profile.save(update_fields=["recommended_courses"])

        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Exact contract keys
        self.assertEqual(
            set(data.keys()),
            {
                "stated_goals",
                "timeframe",
                "risk_comfort",
                "curated_lessons",
                "projected_outcome",
                "recommended_tier",
                # Paywall-placement A/B flag (UX Phase 3, plan §3.5).
                "paywall_placement",
            },
        )

        self.assertEqual(
            data["stated_goals"],
            [
                {"key": "debt", "label": "Pay off debt"},
                {"key": "invest", "label": "Start investing"},
                {"key": "savings", "label": "Grow savings"},
            ],
        )
        self.assertEqual(data["timeframe"], "6_months")
        self.assertEqual(data["risk_comfort"], "medium")

        # First 3 lessons of the personalized path, id/title/topic only
        self.assertEqual(len(data["curated_lessons"]), 3)
        self.assertEqual(
            data["curated_lessons"][0],
            {"id": lessons[0].id, "title": "Lesson 1", "topic": "Budgeting"},
        )
        for item in data["curated_lessons"]:
            self.assertEqual(set(item.keys()), {"id", "title", "topic"})

        # Projected outcome anchored on the primary goal (debt)
        self.assertIsNotNone(data["projected_outcome"])
        self.assertIn("target_date", data["projected_outcome"])
        self.assertTrue(data["projected_outcome"]["text"].startswith("By "))
        self.assertIn("pay down your debt", data["projected_outcome"]["text"])

        # advanced investing experience => pro
        self.assertEqual(data["recommended_tier"], "pro")

    def test_abandoned_questionnaire_returns_nulls_not_500(self):
        # No profile fields, no answers, no accessible content
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["stated_goals"], [])
        self.assertIsNone(data["timeframe"])
        self.assertIsNone(data["risk_comfort"])
        self.assertEqual(data["curated_lessons"], [])
        self.assertIsNone(data["projected_outcome"])
        self.assertEqual(data["recommended_tier"], "plus")

    def test_goals_fall_back_to_questionnaire_answers(self):
        version = QuestionnaireVersion.objects.create(
            version=99, is_active=True, questionnaire_structure={"sections": []}
        )
        QuestionnaireProgress.objects.create(
            user=self.user,
            version=version,
            status="completed",
            answers={"primary_goal": "budget", "biggest_challenge": "debt"},
        )
        response = self.client.get(self.URL)
        data = response.json()
        keys = [g["key"] for g in data["stated_goals"]]
        self.assertEqual(keys, ["budget", "debt"])
        # timeframe resolves from time_horizon answer when profile empty
        self.assertIsNone(data["timeframe"])

    def test_curated_lessons_fall_back_to_start_here(self):
        # No recommended_courses generated yet -> first accessible course
        _, course, lessons = self._make_path_with_lessons(num_lessons=4)
        response = self.client.get(self.URL)
        data = response.json()
        self.assertEqual(len(data["curated_lessons"]), 3)
        self.assertEqual(data["curated_lessons"][0]["title"], "Lesson 1")
        self.assertEqual(data["curated_lessons"][0]["topic"], "Budgeting")

    def test_three_goals_recommends_pro_even_when_inexperienced(self):
        self.profile.goal_types = ["debt", "savings", "invest"]
        self.profile.investing_experience = "beginner"
        self.profile.save()
        response = self.client.get(self.URL)
        self.assertEqual(response.json()["recommended_tier"], "pro")
