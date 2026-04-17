from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from authentication.models import UserProfile
from gamification.models import Mission, MissionCompletion, RewardLedgerEntry, StreakItem
from gamification.services.mission_cycles import cycle_id_for_mission, daily_cycle_id
from gamification.services.rewards import grant_reward

User = get_user_model()


class GamificationIntegrityTests(TestCase):
    def test_mission_completion_unique_per_cycle(self):
        user = User.objects.create_user(username="u1", password="x")
        mission = Mission.objects.create(
            name="Daily read",
            description="d",
            points_reward=10,
            mission_type="daily",
            goal_type="read_fact",
            goal_reference={},
        )
        cid = daily_cycle_id()
        MissionCompletion.objects.create(
            user=user, mission=mission, cycle_id=cid, progress=0, status="not_started"
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MissionCompletion.objects.create(
                    user=user, mission=mission, cycle_id=cid, progress=0, status="not_started"
                )

    def test_profile_streak_consumes_freeze_over_gap(self):
        user = User.objects.create_user(username="u2", password="x")
        profile = UserProfile.objects.get(user=user)
        StreakItem.objects.create(user=user, item_type="streak_freeze", quantity=1)

        today = timezone.localdate()
        profile.last_completed_date = today - timedelta(days=2)
        profile.streak = 4
        profile.save()

        profile.update_streak()

        profile.refresh_from_db()
        self.assertEqual(profile.streak, 5)
        self.assertEqual(profile.last_completed_date, today)
        self.assertEqual(StreakItem.objects.get(user=user, item_type="streak_freeze").quantity, 0)
        self.assertTrue(
            RewardLedgerEntry.objects.filter(
                user=user, event_key__startswith="streak_freeze_used:"
            ).exists()
        )

    def test_grant_reward_zero_ledger(self):
        user = User.objects.create_user(username="u3", password="x")
        res = grant_reward(
            user,
            "audit:test:freeze",
            points=0,
            coins=Decimal("0"),
            bump_streak="none",
            evaluate_badges=False,
            record_zero_ledger=True,
        )
        self.assertTrue(res.granted)
        self.assertTrue(
            RewardLedgerEntry.objects.filter(user=user, event_key="audit:test:freeze").exists()
        )

    def test_cycle_id_for_mission_weekly_format(self):
        mission = Mission(
            name="Weekly",
            description="w",
            points_reward=5,
            mission_type="weekly",
            goal_type="read_fact",
            goal_reference={},
        )
        mission.save()
        wk = cycle_id_for_mission(mission)
        self.assertTrue(wk[0].isdigit())
        self.assertIn("-W", wk)
