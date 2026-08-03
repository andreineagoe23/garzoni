"""Decode percent-encoded statement filenames saved before the parser fix.

The iOS document picker hands back the picked file's name percent-encoded (it
comes off the document URL), so early imports stored — and displayed —
"Statement%2027-JUL-26.pdf". New uploads are decoded on the way in; this
repairs the rows that already exist.
"""

from urllib.parse import unquote

from django.db import migrations


def decode_filenames(apps, schema_editor):
    StatementImport = apps.get_model("budgeting", "StatementImport")
    for statement in StatementImport.objects.exclude(filename="").iterator():
        if "%" not in statement.filename:
            continue
        try:
            decoded = unquote(statement.filename)
        except Exception:
            continue
        if decoded and decoded != statement.filename:
            StatementImport.objects.filter(pk=statement.pk).update(filename=decoded[:128])


def noop(apps, schema_editor):
    """Re-encoding would be lossy and pointless; the decoded name is correct."""


class Migration(migrations.Migration):
    dependencies = [
        ("budgeting", "0004_statementimport_transaction_statement_import_and_more"),
    ]

    operations = [
        migrations.RunPython(decode_filenames, noop),
    ]
