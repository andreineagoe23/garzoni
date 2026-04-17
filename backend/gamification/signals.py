from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from gamification.models import Mission
from gamification.services.mission_cycles import get_or_create_current_mission_completion


@receiver(post_save, sender=User)
def assign_missions_to_new_user(sender, instance, created, **kwargs):
    if not created:
        return
    for mission_type in ("daily", "weekly"):
        missions = Mission.objects.filter(mission_type=mission_type)
        for mission in missions:
            get_or_create_current_mission_completion(
                instance,
                mission,
                defaults={"progress": 0, "status": "not_started"},
            )
