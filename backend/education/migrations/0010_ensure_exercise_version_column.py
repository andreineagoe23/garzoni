# Migration to add core_exercise.version if missing (fixes DBs where 0003 was not applied or was faked).

from django.db import migrations, connection
from django.db.utils import OperationalError


def add_version_column_if_missing(apps, schema_editor):
    vendor = connection.vendor
    with connection.cursor() as cursor:
        table = "core_exercise"
        column = "version"
        add_column = False
        if vendor == "mysql":
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s
                """,
                [table, column],
            )
            add_column = cursor.fetchone()[0] == 0
        elif vendor == "postgresql":
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s LIMIT 1
                """,
                [table, column],
            )
            add_column = cursor.fetchone() is None
        elif vendor == "sqlite":
            # SQLite: only add if missing (0003 may have already added it). Django uses "sqlite" not "sqlite3".
            cursor.execute(f'PRAGMA table_info("{table}")')
            columns = [row[1] for row in cursor.fetchall()]
            if column not in columns:
                try:
                    cursor.execute(
                        f'ALTER TABLE "{table}" ADD COLUMN "{column}" integer NOT NULL DEFAULT 1'
                    )
                except OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        raise
            return
        else:
            add_column = True
        if add_column:
            try:
                if vendor == "mysql":
                    cursor.execute(
                        f"ALTER TABLE {table} ADD COLUMN {column} INT UNSIGNED NOT NULL DEFAULT 1"
                    )
                elif vendor == "postgresql":
                    cursor.execute(
                        f'ALTER TABLE "{table}" ADD COLUMN "{column}" integer NOT NULL DEFAULT 1'
                    )
                else:
                    cursor.execute(
                        f'ALTER TABLE "{table}" ADD COLUMN "{column}" integer NOT NULL DEFAULT 1'
                    )
            except OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    raise


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0009_remove_mastery_core_master_user_id_45d145_idx"),
    ]

    operations = [
        migrations.RunPython(add_version_column_if_missing, noop),
    ]
