# Remove index and unique_together from FAQFeedback so 0004 RenameField can run on SQLite
# (table remake must not recreate an index on the old "faq" field).
# AlterUniqueTogether is state-only so we avoid "Found wrong number (0) of constraints"
# on Postgres. Drop the unique constraint in DB for Postgres so 0004 can add the new one.

from django.db import migrations


def drop_index_if_exists(apps, schema_editor):
    """Drop the FAQFeedback index only if it exists (SQLite/Postgres: index may be missing)."""
    schema_editor.execute("DROP INDEX IF EXISTS core_faqfee_user_id_4c6b63_idx")


def drop_faqfeedback_unique_constraint(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'core_faqfeedback'"
        )
        if not cursor.fetchone():
            return  # table missing, nothing to drop
        cursor.execute(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'core_faqfeedback'::regclass AND contype = 'u'
            AND pg_get_constraintdef(oid) LIKE %s
            """,
            ["%faq_id%"],
        )
        for (name,) in cursor.fetchall():
            quoted = schema_editor.connection.ops.quote_name(name)
            schema_editor.execute(
                "ALTER TABLE core_faqfeedback DROP CONSTRAINT IF EXISTS " + quoted
            )


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0002_faq_count_constraints"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveIndex(
                    model_name="faqfeedback",
                    name="core_faqfee_user_id_4c6b63_idx",
                ),
            ],
            database_operations=[
                migrations.RunPython(drop_index_if_exists, migrations.RunPython.noop),
            ],
        ),
        migrations.RunPython(drop_faqfeedback_unique_constraint, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="faqfeedback",
                    unique_together=set(),
                ),
            ],
            database_operations=[],
        ),
    ]
