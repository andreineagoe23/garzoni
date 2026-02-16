# Rename FAQ/FAQFeedback to SupportEntry/SupportFeedback (tables and models).
# Index/unique_together were removed in 0003 so SQLite table remake in RenameField succeeds.

from django.db import migrations, models


def drop_faq_count_constraints_if_exists(apps, schema_editor):
    """Drop FAQ count constraints if present (Postgres: constraint may be missing or on renamed table)."""
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT tablename FROM pg_tables
            WHERE schemaname = current_schema()
            AND tablename IN ('core_faq', 'support_supportentry', 'core_supportentry')
            """
        )
        tables = [row[0] for row in cursor.fetchall()]
    for table in tables:
        for cname in ("faq_helpful_count_gte_0", "faq_not_helpful_count_gte_0"):
            schema_editor.execute(
                'ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"' % (table, cname)
            )


def _table_exists(schema_editor, table_name):
    # Use literal table name (we control it) to avoid param style issues with Django's SQLite layer
    escaped = table_name.replace("'", "''")
    if schema_editor.connection.vendor == "sqlite":
        with schema_editor.connection.cursor() as c:
            c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='" + escaped + "'")
            return c.fetchone() is not None
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as c:
            c.execute(
                "SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = %s",
                [table_name],
            )
            return c.fetchone() is not None
    return False


def add_supportentry_constraints_if_table_exists(apps, schema_editor):
    """Add check constraints on supportentry only if table exists and constraints don't already exist."""
    table = None
    for name in ("support_supportentry", "core_supportentry"):
        if _table_exists(schema_editor, name):
            table = name
            break
    if not table:
        return
    vendor = schema_editor.connection.vendor
    if vendor == "sqlite":
        return
    if vendor == "postgresql":
        # Use %s so table name is a string literal for ::regclass (double-quotes would be a column ref)
        with schema_editor.connection.cursor() as c:
            c.execute(
                """
                SELECT conname FROM pg_constraint
                WHERE conrelid = (%s)::regclass AND conname IN (%s, %s)
                """,
                [table, "supportentry_helpful_count_gte_0", "supportentry_not_helpful_count_gte_0"],
            )
            existing = {row[0] for row in c.fetchall()}
        if "supportentry_helpful_count_gte_0" not in existing:
            schema_editor.execute(
                'ALTER TABLE "'
                + table.replace('"', '""')
                + '" ADD CONSTRAINT supportentry_helpful_count_gte_0 CHECK (helpful_count >= 0)'
            )
        if "supportentry_not_helpful_count_gte_0" not in existing:
            schema_editor.execute(
                'ALTER TABLE "'
                + table.replace('"', '""')
                + '" ADD CONSTRAINT supportentry_not_helpful_count_gte_0 CHECK (not_helpful_count >= 0)'
            )


def rename_faq_table_if_exists(apps, schema_editor):
    """Rename core_faq to support_supportentry only if core_faq exists."""
    if not _table_exists(schema_editor, "core_faq"):
        return
    vendor = schema_editor.connection.vendor
    if vendor == "sqlite":
        schema_editor.execute("ALTER TABLE core_faq RENAME TO support_supportentry")
    elif vendor == "postgresql":
        schema_editor.execute("ALTER TABLE core_faq RENAME TO support_supportentry")


def _faqfeedback_table_exists(schema_editor):
    return _table_exists(schema_editor, "core_faqfeedback")


def add_index_and_unique_if_table_exists(apps, schema_editor):
    """Add index and unique on (user, support_entry) only if core_faqfeedback exists."""
    if not _faqfeedback_table_exists(schema_editor):
        return
    vendor = schema_editor.connection.vendor
    if vendor == "sqlite":
        schema_editor.execute(
            "CREATE INDEX IF NOT EXISTS core_suppor_user_id_fe2a8f_idx ON core_faqfeedback (user_id, support_entry_id)"
        )
        schema_editor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS core_faqfeedback_user_id_support__uniq ON core_faqfeedback (user_id, support_entry_id)"
        )
    elif vendor == "postgresql":
        schema_editor.execute(
            "CREATE INDEX IF NOT EXISTS core_suppor_user_id_fe2a8f_idx ON core_faqfeedback (user_id, support_entry_id)"
        )
        schema_editor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS core_faqfeedback_user_id_support__uniq ON core_faqfeedback (user_id, support_entry_id)"
        )


def rename_faqfeedback_table_if_exists(apps, schema_editor):
    """Rename table core_faqfeedback to support_supportfeedback only if it exists (avoids no such table)."""
    vendor = schema_editor.connection.vendor
    if vendor == "sqlite":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='core_faqfeedback'"
            )
            if not cursor.fetchone():
                return
        schema_editor.execute("ALTER TABLE core_faqfeedback RENAME TO support_supportfeedback")
    elif vendor == "postgresql":
        schema_editor.execute(
            """
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'core_faqfeedback') THEN
                    ALTER TABLE core_faqfeedback RENAME TO support_supportfeedback;
                END IF;
            END $$;
            """
        )


def rename_faq_column_idempotent(apps, schema_editor):
    """Rename faq_id to support_entry_id; idempotent so retries (e.g. entrypoint) don't fail."""
    vendor = schema_editor.connection.vendor
    if vendor == "postgresql":
        schema_editor.execute(
            """
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema()
                    AND table_name = 'core_faqfeedback' AND column_name = 'faq_id'
                ) THEN
                    ALTER TABLE core_faqfeedback RENAME COLUMN faq_id TO support_entry_id;
                END IF;
            END $$;
            """
        )
    elif vendor == "sqlite":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='core_faqfeedback'"
            )
            if not cursor.fetchone():
                return  # table missing (e.g. 0001 not applied), nothing to rename
            cursor.execute(
                "SELECT 1 FROM pragma_table_info('core_faqfeedback') WHERE name='faq_id'"
            )
            if cursor.fetchone():
                schema_editor.execute(
                    "ALTER TABLE core_faqfeedback RENAME COLUMN faq_id TO support_entry_id"
                )


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0003_remove_faqfeedback_index"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameModel("FAQ", "SupportEntry"),
            ],
            database_operations=[
                migrations.RunPython(rename_faq_table_if_exists, migrations.RunPython.noop),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameField(
                    model_name="faqfeedback",
                    old_name="faq",
                    new_name="support_entry",
                ),
            ],
            database_operations=[
                migrations.RunPython(rename_faq_column_idempotent, migrations.RunPython.noop),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddIndex(
                    model_name="faqfeedback",
                    index=models.Index(
                        fields=["user", "support_entry"],
                        name="core_suppor_user_id_fe2a8f_idx",
                    ),
                ),
                migrations.AlterUniqueTogether(
                    name="faqfeedback",
                    unique_together={("user", "support_entry")},
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    add_index_and_unique_if_table_exists, migrations.RunPython.noop
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameModel("FAQFeedback", "SupportFeedback"),
            ],
            database_operations=[
                migrations.RunPython(rename_faqfeedback_table_if_exists, migrations.RunPython.noop),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="supportentry",
                    name="faq_helpful_count_gte_0",
                ),
                migrations.RemoveConstraint(
                    model_name="supportentry",
                    name="faq_not_helpful_count_gte_0",
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    drop_faq_count_constraints_if_exists, migrations.RunPython.noop
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddConstraint(
                    model_name="supportentry",
                    constraint=models.CheckConstraint(
                        check=models.Q(helpful_count__gte=0),
                        name="supportentry_helpful_count_gte_0",
                    ),
                ),
                migrations.AddConstraint(
                    model_name="supportentry",
                    constraint=models.CheckConstraint(
                        check=models.Q(not_helpful_count__gte=0),
                        name="supportentry_not_helpful_count_gte_0",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    add_supportentry_constraints_if_table_exists, migrations.RunPython.noop
                ),
            ],
        ),
    ]
