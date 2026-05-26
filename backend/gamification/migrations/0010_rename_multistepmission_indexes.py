from django.db import migrations


def _fix_duel_history_row(apps, schema_editor):
    # Environments that had 0010_duel applied before it was renumbered to 0011_duel
    # need the django_migrations row updated so Django doesn't try to re-create core_duel.
    schema_editor.execute(
        "UPDATE django_migrations SET name='0011_duel' "
        "WHERE app='gamification' AND name='0010_duel' "
        "AND NOT EXISTS ("
        "  SELECT 1 FROM django_migrations "
        "  WHERE app='gamification' AND name='0011_duel'"
        ")"
    )


class Migration(migrations.Migration):
    """Django auto-rename of MultiStepMission/MultiStepMissionProgress auto-generated indexes.

    The index name hash changed in a recent Django release; this migration just renames the
    existing indexes to the new deterministic names. No schema effect beyond the rename.

    Also fixes the django_migrations history for environments where 0010_duel was already
    applied before it was renumbered to 0011_duel.
    """

    dependencies = [
        ("gamification", "0009_multistep_missions"),
    ]

    operations = [
        migrations.RunPython(_fix_duel_history_row, migrations.RunPython.noop),
        migrations.RenameIndex(
            model_name="multistepmission",
            new_name="core_multis_is_acti_fae58e_idx",
            old_name="core_multis_is_acti_3bbf1d_idx",
        ),
        migrations.RenameIndex(
            model_name="multistepmission",
            new_name="core_multis_starts__dd9cee_idx",
            old_name="core_multis_starts__d9fcb9_idx",
        ),
        migrations.RenameIndex(
            model_name="multistepmissionprogress",
            new_name="core_multis_user_id_f791e7_idx",
            old_name="core_multis_user_id_e7907a_idx",
        ),
        migrations.RenameIndex(
            model_name="multistepmissionprogress",
            new_name="core_multis_mission_b70b04_idx",
            old_name="core_multis_mission_e190d9_idx",
        ),
    ]
