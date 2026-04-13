from collections import defaultdict

from django.db import migrations, models


def _cycle_for_mc(MissionCompletion, mc, today_iso: str, tz):
    from django.utils import timezone as dj_tz

    m = mc.mission
    if m.mission_type == "daily":
        if mc.status == "completed" and mc.completed_at:
            return dj_tz.localtime(mc.completed_at, tz).date().isoformat()
        return today_iso
    if m.mission_type == "weekly":
        if mc.status == "completed" and mc.completed_at:
            dt = dj_tz.localtime(mc.completed_at, tz)
        else:
            dt = dj_tz.now()
        y, w, _ = dt.isocalendar()
        return f"{y}-W{w:02d}"
    return mc.cycle_id or ""


def forwards_cycle_backfill(apps, schema_editor):
    MissionCompletion = apps.get_model("gamification", "MissionCompletion")
    from django.utils import timezone as dj_tz

    tz = dj_tz.get_current_timezone()
    today_iso = dj_tz.localdate().isoformat()

    legacy = (
        MissionCompletion.objects.filter(mission__mission_type__in=("daily", "weekly"))
        .filter(models.Q(cycle_id="") | models.Q(cycle_id__isnull=True))
        .select_related("mission")
    )

    groups = defaultdict(list)
    for mc in legacy.iterator(chunk_size=500):
        groups[(mc.user_id, mc.mission_id)].append(mc)

    for _key, rows in groups.items():
        rows.sort(key=lambda r: r.id)
        if len(rows) == 1:
            mc = rows[0]
            mc.cycle_id = _cycle_for_mc(MissionCompletion, mc, today_iso, tz)
            mc.save(update_fields=["cycle_id"])
            continue
        for r in rows[:-1]:
            r.cycle_id = f"x{r.pk}"[:40]
            r.save(update_fields=["cycle_id"])
        mc = rows[-1]
        mc.cycle_id = _cycle_for_mc(MissionCompletion, mc, today_iso, tz)
        mc.save(update_fields=["cycle_id"])

    dupes = (
        MissionCompletion.objects.values("user_id", "mission_id", "cycle_id")
        .annotate(c=models.Count("id"))
        .filter(c__gt=1)
    )
    for d in dupes.iterator(chunk_size=200):
        rows = list(
            MissionCompletion.objects.filter(
                user_id=d["user_id"],
                mission_id=d["mission_id"],
                cycle_id=d["cycle_id"],
            ).order_by("id")
        )
        for r in rows[:-1]:
            r.cycle_id = f"x{r.pk}"[:40]
            r.save(update_fields=["cycle_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gamification", "0006_rewardledgerentry"),
        ("education", "0025_rename_userprogress_streak_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="badge",
            name="criteria_slug",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Optional content-specific criterion (e.g. path:slug). Evaluated in addition to criteria_type.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="missioncompletion",
            name="cycle_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Period key for this row (daily ISO date, weekly ISO week). Empty = legacy rolling row.",
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="mission",
            name="goal_type",
            field=models.CharField(
                choices=[
                    ("complete_lesson", "Complete Lesson"),
                    ("add_savings", "Add Savings"),
                    ("read_fact", "Read Finance Fact"),
                    ("complete_path", "Complete Path"),
                    ("clear_review_queue", "Clear Review Queue"),
                    ("streak_rescue", "Streak Rescue"),
                ],
                default="complete_lesson",
                max_length=50,
            ),
        ),
        migrations.RunPython(forwards_cycle_backfill, noop_reverse),
        migrations.AddConstraint(
            model_name="missioncompletion",
            constraint=models.UniqueConstraint(
                fields=("user", "mission", "cycle_id"),
                name="missioncompletion_user_mission_cycle_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="missioncompletion",
            index=models.Index(fields=["user", "cycle_id"], name="core_missio_user_cycle_idx"),
        ),
    ]
