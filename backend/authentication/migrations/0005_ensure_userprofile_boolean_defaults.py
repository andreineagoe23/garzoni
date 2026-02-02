# Fix MySQL "Field 'sound_enabled' doesn't have a default value" on PythonAnywhere.
# Django often adds NOT NULL columns without a DB-level DEFAULT; this migration
# sets DEFAULT 1 so INSERTs succeed when the app omits the field.

from django.db import migrations


def apply_mysql_defaults(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE core_userprofile "
            "MODIFY COLUMN sound_enabled TINYINT(1) NOT NULL DEFAULT 1"
        )
        cursor.execute(
            "ALTER TABLE core_userprofile "
            "MODIFY COLUMN animations_enabled TINYINT(1) NOT NULL DEFAULT 1"
        )


def reverse_mysql_defaults(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE core_userprofile " "MODIFY COLUMN sound_enabled TINYINT(1) NOT NULL"
        )
        cursor.execute(
            "ALTER TABLE core_userprofile " "MODIFY COLUMN animations_enabled TINYINT(1) NOT NULL"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0004_userprofile_sound_enabled_userprofile_animations_enabled"),
    ]

    operations = [
        migrations.RunPython(apply_mysql_defaults, reverse_mysql_defaults),
    ]
