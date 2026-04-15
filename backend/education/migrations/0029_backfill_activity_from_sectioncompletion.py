from django.db import migrations


def _exercise_object_id_from_section(section) -> int:
    data = section.exercise_data if isinstance(section.exercise_data, dict) else {}
    for key in ("catalog_exercise_id", "exercise_id", "exerciseId", "linkedExerciseId"):
        raw = data.get(key)
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if value > 0:
            return value
    return int(section.id)


def _backfill_from_section_completion(apps, schema_editor):
    DailyActivityLog = apps.get_model("education", "DailyActivityLog")
    LessonSection = apps.get_model("education", "LessonSection")
    SectionCompletion = apps.get_model("education", "SectionCompletion")

    published_section_ids_by_lesson = {}
    published_section_count_by_lesson = {}
    for row in LessonSection.objects.filter(is_published=True).values("id", "lesson_id"):
        lid = int(row["lesson_id"])
        sid = int(row["id"])
        published_section_ids_by_lesson.setdefault(lid, set()).add(sid)
    for lid, ids in published_section_ids_by_lesson.items():
        published_section_count_by_lesson[lid] = len(ids)

    seen_completed_sections = {}
    lesson_already_logged = set(
        DailyActivityLog.objects.filter(activity_type="lesson").values_list("user_id", "object_id")
    )

    rows = SectionCompletion.objects.select_related(
        "user_progress",
        "section",
        "section__lesson",
        "section__lesson__course",
    ).order_by("completed_at", "id")

    for sc in rows.iterator():
        user_id = getattr(sc.user_progress, "user_id", None)
        section = getattr(sc, "section", None)
        if not user_id or not section:
            continue
        lesson = getattr(section, "lesson", None)
        lesson_id = getattr(lesson, "id", None)
        course_id = getattr(lesson, "course_id", None)
        day = sc.completed_at.date()

        # Backfill exercise activity for section-based exercises.
        if section.content_type == "exercise" or bool(section.exercise_type):
            DailyActivityLog.objects.get_or_create(
                user_id=user_id,
                activity_type="exercise",
                object_id=_exercise_object_id_from_section(section),
                defaults={"course_id": course_id, "date": day},
            )

        # Backfill lesson activity on the day the final published section was completed.
        if not lesson_id:
            continue
        lesson_total = published_section_count_by_lesson.get(int(lesson_id), 0)
        if lesson_total <= 0:
            continue

        key = (int(user_id), int(lesson_id))
        done_set = seen_completed_sections.setdefault(key, set())
        if int(section.id) in published_section_ids_by_lesson.get(int(lesson_id), set()):
            done_set.add(int(section.id))

        if len(done_set) >= lesson_total and key not in lesson_already_logged:
            DailyActivityLog.objects.get_or_create(
                user_id=user_id,
                activity_type="lesson",
                object_id=lesson_id,
                defaults={"course_id": course_id, "date": day},
            )
            lesson_already_logged.add(key)


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0028_dailyactivitylog"),
    ]

    operations = [
        migrations.RunPython(_backfill_from_section_completion, migrations.RunPython.noop),
    ]
