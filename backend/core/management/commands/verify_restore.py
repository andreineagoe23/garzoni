"""
Verify that key data is present after a DB restore.
Run after loaddata to ensure users, lessons, exercises, etc. are there.
"""

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Verify key models have data (run after restoring a backup)."

    def handle(self, *args, **options):
        from django.apps import apps

        checks = []
        # Core auth
        checks.append(("auth.User", User.objects.count))
        if apps.is_installed("authentication"):
            from authentication.models import UserProfile

            checks.append(("authentication.UserProfile", UserProfile.objects.count))
        if apps.is_installed("education"):
            from education.models import Path, Course, Lesson, LessonSection, Exercise

            checks.append(("education.Path", Path.objects.count))
            checks.append(("education.Course", Course.objects.count))
            checks.append(("education.Lesson", Lesson.objects.count))
            checks.append(("education.LessonSection", LessonSection.objects.count))
            checks.append(("education.Exercise", Exercise.objects.count))
        if apps.is_installed("gamification"):
            from gamification.models import Mission

            checks.append(("gamification.Mission", Mission.objects.count))
        if apps.is_installed("onboarding"):
            from onboarding.models import QuestionnaireVersion

            checks.append(("onboarding.QuestionnaireVersion", QuestionnaireVersion.objects.count))

        self.stdout.write("Data check (current database):")
        self.stdout.write("-" * 50)
        total = 0
        for label, count_fn in checks:
            try:
                n = count_fn()
            except Exception as e:
                n = -1
                self.stdout.write(self.style.WARNING(f"  {label}: error ({e})"))
            else:
                total += n
                self.stdout.write(f"  {label}: {n}")
        self.stdout.write("-" * 50)
        self.stdout.write(f"  Total (key tables): {total}")

        if total == 0:
            self.stdout.write(
                self.style.WARNING("No data found. Restore may have failed or backup was empty.")
            )
        else:
            self.stdout.write(self.style.SUCCESS("Data present. Run: python manage.py test"))
        self.stdout.write("")
