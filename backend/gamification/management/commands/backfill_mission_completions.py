"""
Create MissionCompletion rows for all users for all missions (so existing users see the full pool).
Run after loading new missions: python manage.py backfill_mission_completions
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from gamification.models import Mission, MissionCompletion


class Command(BaseCommand):
    help = "Create MissionCompletion for every user for every mission they don't have yet"

    def handle(self, *args, **options):
        missions = list(Mission.objects.all())
        if not missions:
            self.stdout.write(
                self.style.WARNING("No missions in database. Run load_mission_pool first.")
            )
            return
        users = User.objects.filter(is_active=True)
        created = 0
        for user in users:
            for mission in missions:
                if not MissionCompletion.objects.filter(user=user, mission=mission).exists():
                    MissionCompletion.objects.create(
                        user=user,
                        mission=mission,
                        progress=0,
                        status="not_started",
                    )
                    created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created} MissionCompletion row(s). {len(users)} users, {len(missions)} missions."
            )
        )
