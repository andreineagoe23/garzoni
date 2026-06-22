from django.core.management.base import BaseCommand
from django.db.models import Min

from authentication.models import UserProfile
from authentication.services.profile_analytics import (
    mark_onboarding_completed,
    sync_last_login_date,
)
from onboarding.models import QuestionnaireProgress


class Command(BaseCommand):
    help = (
        "Backfill UserProfile analytics timestamps from QuestionnaireProgress, "
        "LessonCompletion, and User.last_login."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report counts without writing.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        User = get_user_model()

        onboarding_rows = QuestionnaireProgress.objects.filter(
            status="completed",
            completed_at__isnull=False,
            user__profile__onboarding_completed_at__isnull=True,
        ).select_related("user")
        onboarding_count = onboarding_rows.count()

        from education.models import LessonCompletion

        first_lessons = (
            LessonCompletion.objects.values("user_progress__user_id")
            .annotate(first_at=Min("completed_at"))
            .filter(user_progress__user__profile__first_lesson_at__isnull=True)
        )
        first_lesson_count = first_lessons.count()

        login_profiles = UserProfile.objects.filter(
            last_login_date__isnull=True,
            user__last_login__isnull=False,
        ).select_related("user")
        login_count = login_profiles.count()

        self.stdout.write(
            f"Onboarding completions to backfill: {onboarding_count}\n"
            f"First lesson timestamps to backfill: {first_lesson_count}\n"
            f"Last login dates to backfill: {login_count}"
        )

        if dry_run:
            return

        for progress in onboarding_rows.iterator():
            mark_onboarding_completed(progress.user, when=progress.completed_at)

        for row in first_lessons.iterator():
            user_id = row["user_progress__user_id"]
            first_at = row["first_at"]
            if not user_id or not first_at:
                continue
            UserProfile.objects.filter(user_id=user_id, first_lesson_at__isnull=True).update(
                first_lesson_at=first_at
            )

        for profile in login_profiles.iterator():
            sync_last_login_date(profile.user, when=profile.user.last_login)

        self.stdout.write(self.style.SUCCESS("Backfill complete."))
