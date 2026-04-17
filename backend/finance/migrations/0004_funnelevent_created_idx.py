from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_funnelevent_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="funnelevent",
            index=models.Index(fields=["created_at"], name="funnelevent_created_idx"),
        ),
    ]
