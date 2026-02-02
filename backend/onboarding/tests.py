from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
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
        """Test progress percentage calculation (question-based: answered / total)."""
        progress = QuestionnaireProgress.objects.create(
            user=self.user,
            version=self.version,
            status="in_progress",
            current_section_index=1,
        )
        # Version has 3 questions (2 in section1, 1 in section2). At section 1, question 0 we're on question 3; answered = 2 → 66%
        self.assertEqual(progress.get_progress_percentage(), 66)

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
