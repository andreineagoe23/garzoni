import sys

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
import uuid
from authentication.models import UserProfile
from core.utils import normalize_text_encoding


@receiver(pre_save, sender=User)
def normalize_user_identity_fields(sender, instance, **kwargs):
    """
    Normalize User identity fields before every save so mojibake does not persist
    back to the database (e.g. RoÈ™u -> Roșu, Â£ -> £).
    """
    instance.username = normalize_text_encoding(instance.username) or ""
    instance.first_name = normalize_text_encoding(instance.first_name) or ""
    instance.last_name = normalize_text_encoding(instance.last_name) or ""
    instance.email = normalize_text_encoding(instance.email) or ""


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Signal handler that automatically creates a UserProfile for a newly created User.
    Generates a unique referral code for the user profile upon creation.
    Skip during loaddata so fixture UserProfile rows load without duplicate-key errors.
    """
    if "loaddata" in sys.argv:
        return
    if created:
        profile, created = UserProfile.objects.get_or_create(user=instance)
        if created:
            profile.referral_code = uuid.uuid4().hex[:8].upper()
            profile.save()
