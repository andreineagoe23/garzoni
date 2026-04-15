from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from gamification.models import Mission, MissionCompletion
from gamification.services.mission_cycles import daily_cycle_id, weekly_cycle_id


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
        self.assertIn(daily_mission.id, [row["id"] for row in response.data.get("daily_missions", [])])
        self.assertIn(weekly_mission.id, [row["id"] for row in response.data.get("weekly_missions", [])])
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
