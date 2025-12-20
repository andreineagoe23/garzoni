from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from gamification.models import Mission, MissionCompletion


@receiver(post_save, sender=User)
def assign_missions_to_new_user(sender, instance, created, **kwargs):
    if created:
        for mission_type in ["daily", "weekly"]:
            missions = Mission.objects.filter(mission_type=mission_type)
            for mission in missions:
                MissionCompletion.objects.get_or_create(
                    user=instance,
                    mission=mission,
                    defaults={"progress": 0, "status": "not_started"},
                )

        # Assign weekly missions
        weekly_missions = Mission.objects.filter(mission_type="weekly")
        for mission in weekly_missions:
            MissionCompletion.objects.get_or_create(
                user=instance,
                mission=mission,
                defaults={"progress": 0, "status": "not_started"},
            )
        print(f"Weekly missions assigned to new user: {instance.username}")
