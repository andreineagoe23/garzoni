import re

from django.db import migrations


HTML_BLOCK_RE = re.compile(
    r"\s*<p>\s*(?:Recommended Video|Video recomandat)\s*:.*?</p>\s*$",
    re.IGNORECASE | re.DOTALL,
)

PLAIN_BLOCK_RE = re.compile(
    r"\s*(?:\n|\r\n)+\s*(?:Recommended Video|Video recomandat)\s*:.*$",
    re.IGNORECASE | re.DOTALL,
)


def _strip(text):
    if not text:
        return text
    cleaned = HTML_BLOCK_RE.sub("", text)
    cleaned = PLAIN_BLOCK_RE.sub("", cleaned)
    return cleaned.rstrip()


def forwards(apps, schema_editor):
    LessonSection = apps.get_model("education", "LessonSection")
    LessonSectionTranslation = apps.get_model("education", "LessonSectionTranslation")

    for section in LessonSection.objects.exclude(text_content__isnull=True).exclude(
        text_content__exact=""
    ):
        cleaned = _strip(section.text_content)
        if cleaned != section.text_content:
            section.text_content = cleaned
            section.save(update_fields=["text_content"])

    for tr in LessonSectionTranslation.objects.exclude(text_content__isnull=True).exclude(
        text_content__exact=""
    ):
        cleaned = _strip(tr.text_content)
        if cleaned != tr.text_content:
            tr.text_content = cleaned
            tr.save(update_fields=["text_content"])


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0030_rename_education_d_user_id_534fd8_idx_education_d_user_id_fc5997_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
