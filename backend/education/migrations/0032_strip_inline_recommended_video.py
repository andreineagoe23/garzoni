import re

from django.db import migrations


INLINE_BLOCK_RE = re.compile(
    r"\s*(?:Recommended Video|Video recomandat)\s*:\s*.*$",
    re.IGNORECASE | re.DOTALL,
)


def forwards(apps, schema_editor):
    LessonSectionTranslation = apps.get_model(
        "education", "LessonSectionTranslation"
    )
    for tr in LessonSectionTranslation.objects.exclude(text_content__isnull=True).exclude(
        text_content__exact=""
    ):
        cleaned = INLINE_BLOCK_RE.sub("", tr.text_content).rstrip()
        if cleaned != tr.text_content:
            tr.text_content = cleaned
            tr.save(update_fields=["text_content"])


class Migration(migrations.Migration):
    dependencies = [
        ("education", "0031_strip_recommended_video_blocks"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
