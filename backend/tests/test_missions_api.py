from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from gamification.models import Mission, MissionCompletion
from gamification.services.mission_cycles import (
    daily_cycle_id,
    select_cycle_missions,
    weekly_cycle_id,
)
from gamification.services.missions import touch_assigned_completions


# Eager-mode self-heal semantics: GET materializes current-cycle rows for the
# whole pool. Kept supported behind the MISSIONS_LAZY_ASSIGNMENT kill switch.
@override_settings(MISSIONS_LAZY_ASSIGNMENT=False)
class MissionsApiSelfHealTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="missions-self-heal-user",
            password="unit-test-password!",
        )
        self.client.force_authenticate(user=self.user)

    def test_missions_get_creates_current_cycle_rows_when_only_stale_rows_exist(self):
        daily_mission = Mission.objects.create(
            name="Daily mission fixture",
            description="Daily mission fixture description",
            points_reward=10,
            mission_type="daily",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 1},
        )
        weekly_mission = Mission.objects.create(
            name="Weekly mission fixture",
            description="Weekly mission fixture description",
            points_reward=40,
            mission_type="weekly",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 2},
        )

        # Stale cycle rows should be ignored by MissionView.get filtering.
        MissionCompletion.objects.create(
            user=self.user,
            mission=daily_mission,
            cycle_id="2000-01-01",
            progress=0,
            status="not_started",
        )
        MissionCompletion.objects.create(
            user=self.user,
            mission=weekly_mission,
            cycle_id="2000-W01",
            progress=0,
            status="not_started",
        )

        response = self.client.get("/api/missions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        daily_payload = response.data.get("daily_missions", [])
        weekly_payload = response.data.get("weekly_missions", [])
        self.assertGreaterEqual(len(daily_payload), 1)
        self.assertGreaterEqual(len(weekly_payload), 1)
        self.assertIn(daily_mission.id, [row["id"] for row in daily_payload])
        self.assertIn(weekly_mission.id, [row["id"] for row in weekly_payload])

        self.assertTrue(
            MissionCompletion.objects.filter(
                user=self.user,
                mission=daily_mission,
                cycle_id=daily_cycle_id(),
            ).exists()
        )
        self.assertTrue(
            MissionCompletion.objects.filter(
                user=self.user,
                mission=weekly_mission,
                cycle_id=weekly_cycle_id(),
            ).exists()
        )

    def test_missions_get_creates_current_cycle_rows_when_only_legacy_rows_exist(self):
        daily_mission = Mission.objects.create(
            name="Legacy daily mission fixture",
            description="Legacy daily mission fixture description",
            points_reward=20,
            mission_type="daily",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 1},
        )
        weekly_mission = Mission.objects.create(
            name="Legacy weekly mission fixture",
            description="Legacy weekly mission fixture description",
            points_reward=50,
            mission_type="weekly",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 2},
        )

        MissionCompletion.objects.create(
            user=self.user,
            mission=daily_mission,
            cycle_id="",
            progress=0,
            status="not_started",
        )
        MissionCompletion.objects.create(
            user=self.user,
            mission=weekly_mission,
            cycle_id="",
            progress=0,
            status="not_started",
        )

        response = self.client.get("/api/missions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            daily_mission.id, [row["id"] for row in response.data.get("daily_missions", [])]
        )
        self.assertIn(
            weekly_mission.id, [row["id"] for row in response.data.get("weekly_missions", [])]
        )
        self.assertTrue(
            MissionCompletion.objects.filter(
                user=self.user,
                mission=daily_mission,
                cycle_id=daily_cycle_id(),
            ).exists()
        )
        self.assertTrue(
            MissionCompletion.objects.filter(
                user=self.user,
                mission=weekly_mission,
                cycle_id=weekly_cycle_id(),
            ).exists()
        )

    def test_missions_get_picks_up_missions_added_after_user_registration(self):
        # Existing missions allow signal assignment at registration.
        Mission.objects.create(
            name="Starter daily mission",
            description="Starter daily mission description",
            points_reward=10,
            mission_type="daily",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 1},
        )
        Mission.objects.create(
            name="Starter weekly mission",
            description="Starter weekly mission description",
            points_reward=30,
            mission_type="weekly",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 2},
        )

        late_user = User.objects.create_user(
            username="missions-post-registration-user",
            password="unit-test-password!",
        )
        self.client.force_authenticate(user=late_user)

        late_daily_mission = Mission.objects.create(
            name="Late daily mission",
            description="Late daily mission description",
            points_reward=25,
            mission_type="daily",
            goal_type="complete_lesson",
            goal_reference={"required_lessons": 1},
        )

        self.assertFalse(
            MissionCompletion.objects.filter(
                user=late_user,
                mission=late_daily_mission,
                cycle_id=daily_cycle_id(),
            ).exists()
        )

        response = self.client.get("/api/missions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data.get("daily_missions", [])), 1)
        self.assertTrue(
            MissionCompletion.objects.filter(
                user=late_user,
                mission=late_daily_mission,
                cycle_id=daily_cycle_id(),
            ).exists()
        )


@override_settings(MISSIONS_LAZY_ASSIGNMENT=True)
class MissionsLazyAssignmentTest(APITestCase):
    """Lazy assignment: picks are computed, GET never writes, rows materialize
    only when a mission is actually touched."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="missions-lazy-user", password="unit-test-password!"
        )
        goal_types = ["complete_lesson", "add_savings", "clear_review_queue", "read_fact"]
        cls.daily = [
            Mission.objects.create(
                name=f"Lazy daily {i}",
                description="d",
                points_reward=10 + i,
                mission_type="daily",
                goal_type=goal_types[i % len(goal_types)],
            )
            for i in range(6)
        ]
        cls.weekly = [
            Mission.objects.create(
                name=f"Lazy weekly {i}",
                description="w",
                points_reward=40 + i,
                mission_type="weekly",
                goal_type=goal_types[i % len(goal_types)],
            )
            for i in range(6)
        ]

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_get_returns_picks_without_writing_rows(self):
        self.assertEqual(MissionCompletion.objects.filter(user=self.user).count(), 0)
        response = self.client.get("/api/missions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["daily_missions"]), 4)
        self.assertEqual(len(response.data["weekly_missions"]), 4)
        # Pure read: no MissionCompletion / MultiStepMissionProgress writes.
        self.assertEqual(MissionCompletion.objects.filter(user=self.user).count(), 0)

    def test_get_is_deterministic_within_cycle(self):
        first = self.client.get("/api/missions/").data
        second = self.client.get("/api/missions/").data
        ids = lambda rows: [r["id"] for r in rows]  # noqa: E731
        self.assertEqual(ids(first["daily_missions"]), ids(second["daily_missions"]))
        self.assertEqual(ids(first["weekly_missions"]), ids(second["weekly_missions"]))

    def test_trigger_materializes_rows_only_for_assigned_picks(self):
        assigned_lesson_ids = {
            m["id"]
            for mtype in ("daily", "weekly")
            for m in select_cycle_missions(self.user.id, mtype)
            if m["goal_type"] == "complete_lesson"
        }
        rows = list(touch_assigned_completions(self.user, ["complete_lesson"]))
        self.assertEqual({r.mission_id for r in rows}, assigned_lesson_ids)
        # No rows exist for missions outside the assigned picks.
        self.assertEqual(
            MissionCompletion.objects.filter(user=self.user)
            .exclude(mission_id__in=assigned_lesson_ids)
            .count(),
            0,
        )

    def test_touched_rows_take_display_precedence(self):
        # A mission outside the deterministic picks that the user progressed
        # (e.g. swap-in) must stay visible in its real state.
        picks = {m["id"] for m in select_cycle_missions(self.user.id, "daily")}
        outside = next(m for m in self.daily if m.id not in picks)
        MissionCompletion.objects.create(
            user=self.user,
            mission=outside,
            cycle_id=daily_cycle_id(),
            progress=50,
            status="in_progress",
        )
        response = self.client.get("/api/missions/")
        rows = {r["id"]: r for r in response.data["daily_missions"]}
        self.assertIn(outside.id, rows)
        self.assertEqual(rows[outside.id]["progress"], 50)
        self.assertEqual(len(response.data["daily_missions"]), 4)


class ReviewQueueMissionProgressTest(APITestCase):
    """`clear_review_queue` missions used to have no trigger at all: nothing
    called update_progress for that goal type, so every user carried a
    permanently-0% mission. Clearing a due review item must advance them."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="review-mission-user",
            password="unit-test-password!",
        )
        self.client.force_authenticate(user=self.user)
        self.mission = Mission.objects.create(
            name="Clear your reviews",
            description="Clear the review queue",
            points_reward=25,
            mission_type="daily",
            goal_type="clear_review_queue",
            goal_reference={"target_count": 1},
        )

    def test_correct_review_answer_advances_review_queue_mission(self):
        from django.urls import reverse

        from education.models import Course, Exercise, Path

        path = Path.objects.create(title="Review Path", description="")
        Course.objects.create(title="Review Skill", description="", path=path, is_active=True)
        exercise = Exercise.objects.create(
            type="numeric",
            question="What is 2+2?",
            exercise_data={},
            correct_answer=4,
            category="Review Skill",
            is_published=True,
        )

        # No row exists yet — the trigger has to materialize it lazily.
        self.assertFalse(
            MissionCompletion.objects.filter(user=self.user, mission=self.mission).exists()
        )

        response = self.client.post(
            reverse("exercise-submit", kwargs={"pk": exercise.pk}),
            {"user_answer": 4},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["correct"])

        completion = MissionCompletion.objects.get(user=self.user, mission=self.mission)
        self.assertEqual(completion.progress, 100)
        self.assertEqual(completion.status, "completed")
        self.assertEqual(completion.xp_awarded, 25)


class MultiStepQuestRewardTest(APITestCase):
    """Finishing a quest advertised `points_reward` / `badge_name` in the API
    payload but granted neither — the last step paid nothing."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="quest-reward-user",
            password="unit-test-password!",
        )

    def test_final_step_grants_xp_and_badge_once(self):
        from gamification.models import (
            Badge,
            MultiStepMission,
            MultiStepMissionProgress,
            RewardLedgerEntry,
            UserBadge,
        )

        Badge.objects.get_or_create(
            name="Market Ready",
            defaults={
                "description": "Quest badge",
                "criteria_type": "missions_completed",
                "threshold": 1,
            },
        )
        mission = MultiStepMission.objects.create(
            name="The Investor's Week",
            slug="investors-week-test",
            description="",
            points_reward=200,
            badge_name="Market Ready",
            steps=[{"id": "a"}, {"id": "b"}],
        )
        progress = MultiStepMissionProgress.objects.create(user=self.user, mission=mission)

        progress.mark_step_complete("a")
        self.assertEqual(progress.status, "in_progress")
        self.assertEqual(RewardLedgerEntry.objects.filter(user=self.user).count(), 0)

        progress.mark_step_complete("b")
        self.assertEqual(progress.status, "completed")
        entries = RewardLedgerEntry.objects.filter(
            user=self.user,
            event_key=f"multistep_mission_complete:{self.user.id}:{mission.id}",
        )
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().points, 200)
        self.assertTrue(
            UserBadge.objects.filter(user=self.user, badge__name="Market Ready").exists()
        )

        # Re-running the last step must not pay twice.
        progress.mark_step_complete("b")
        self.assertEqual(
            RewardLedgerEntry.objects.filter(
                user=self.user,
                event_key=f"multistep_mission_complete:{self.user.id}:{mission.id}",
            ).count(),
            1,
        )
