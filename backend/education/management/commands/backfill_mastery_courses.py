from django.core.management.base import BaseCommand
from django.db import transaction

from education.models import Course, Mastery, MasterySnapshot
from education.views import _resolve_course_for_skill


def _move_snapshots_to_course(user, old_skill: str, course: Course):
    for snapshot in list(MasterySnapshot.objects.filter(user=user, skill=old_skill)):
        target = MasterySnapshot.objects.filter(
            user=user,
            course=course,
            recorded_on=snapshot.recorded_on,
        ).first()
        if target and target.id != snapshot.id:
            target.proficiency = max(target.proficiency, snapshot.proficiency)
            target.skill = course.title
            target.save(update_fields=["proficiency", "skill"])
            snapshot.delete()
            continue

        snapshot.course = course
        snapshot.skill = course.title
        snapshot.save(update_fields=["course", "skill"])


class Command(BaseCommand):
    help = "Map legacy string-keyed mastery rows to course-keyed mastery rows."

    def handle(self, *args, **options):
        mapped = 0
        merged = 0
        legacy = 0

        with transaction.atomic():
            for row in Mastery.objects.select_for_update().filter(course__isnull=True):
                old_skill = row.skill
                course = _resolve_course_for_skill(row.skill)
                if not course:
                    row.legacy = True
                    row.save(update_fields=["legacy", "last_reviewed"])
                    legacy += 1
                    continue

                target = Mastery.objects.filter(user=row.user, course=course).first()
                if target and target.id != row.id:
                    target.proficiency = max(target.proficiency, row.proficiency)
                    target.due_at = max(target.due_at, row.due_at)
                    target.skill = course.title
                    target.legacy = False
                    target.save(
                        update_fields=["skill", "proficiency", "due_at", "legacy", "last_reviewed"]
                    )
                    _move_snapshots_to_course(row.user, old_skill, course)
                    row.legacy = True
                    row.save(update_fields=["legacy", "last_reviewed"])
                    merged += 1
                    continue

                row.course = course
                row.skill = course.title
                row.legacy = False
                row.save(update_fields=["course", "skill", "legacy", "last_reviewed"])
                _move_snapshots_to_course(row.user, old_skill, course)
                mapped += 1

        # Attach orphan snapshots where possible after row names were normalized.
        for course in Course.objects.all():
            for snapshot in list(
                MasterySnapshot.objects.filter(course__isnull=True, skill=course.title)
            ):
                _move_snapshots_to_course(snapshot.user, snapshot.skill, course)

        self.stdout.write(
            self.style.SUCCESS(
                f"mastery course backfill complete: mapped={mapped} merged={merged} legacy={legacy}"
            )
        )
