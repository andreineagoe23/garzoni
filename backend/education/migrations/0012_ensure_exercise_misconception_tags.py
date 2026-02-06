# Migration to add core_exercise.misconception_tags if missing (fixes DBs where 0003 was not applied or was faked).

from django.db import migrations, connection
from django.db.utils import OperationalError


def add_column_if_missing(table, column, sql_add_mysql, sql_add_postgresql, sql_add_sqlite):
    vendor = connection.vendor
    with connection.cursor() as cursor:
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
            cursor.execute(f'PRAGMA table_info("{table}")')
            columns = [row[1] for row in cursor.fetchall()]
            if column not in columns:
                try:
                    cursor.execute(sql_add_sqlite.format(table=table, column=column))
                except OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        raise
            return
        else:
            add_column = True
        if add_column:
            try:
                if vendor == "mysql":
                    cursor.execute(sql_add_mysql)
                elif vendor == "postgresql":
                    cursor.execute(sql_add_postgresql)
                else:
                    cursor.execute(sql_add_postgresql)
            except OperationalError as e:
                if "duplicate column name" not in str(e).lower():
                    raise


def ensure_exercise_columns(apps, schema_editor):
    table = "core_exercise"
    # misconception_tags (JSONField, default=list)
    add_column_if_missing(
        table,
        "misconception_tags",
        sql_add_mysql=f"ALTER TABLE {table} ADD COLUMN misconception_tags JSON DEFAULT (CAST('[]' AS JSON))",
        sql_add_postgresql=f"ALTER TABLE \"{table}\" ADD COLUMN misconception_tags jsonb NOT NULL DEFAULT '[]'",
        sql_add_sqlite='ALTER TABLE "{table}" ADD COLUMN "{column}" text NOT NULL DEFAULT \'[]\'',
    )
    # error_patterns (JSONField, default=list) - same as 0003
    add_column_if_missing(
        table,
        "error_patterns",
        sql_add_mysql=f"ALTER TABLE {table} ADD COLUMN error_patterns JSON DEFAULT (CAST('[]' AS JSON))",
        sql_add_postgresql=f"ALTER TABLE \"{table}\" ADD COLUMN error_patterns jsonb NOT NULL DEFAULT '[]'",
        sql_add_sqlite='ALTER TABLE "{table}" ADD COLUMN "{column}" text NOT NULL DEFAULT \'[]\'',
    )
    # is_published (BooleanField, default=False) - same as 0003
    add_column_if_missing(
        table,
        "is_published",
        sql_add_mysql=f"ALTER TABLE {table} ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 0",
        sql_add_postgresql=f'ALTER TABLE "{table}" ADD COLUMN is_published boolean NOT NULL DEFAULT false',
        sql_add_sqlite='ALTER TABLE "{table}" ADD COLUMN "{column}" integer NOT NULL DEFAULT 0',
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0011_alter_lessonsection_exercise_type"),
    ]

    operations = [
        migrations.RunPython(ensure_exercise_columns, noop),
    ]
