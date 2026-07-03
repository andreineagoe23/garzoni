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
