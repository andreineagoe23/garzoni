from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0003_subscriptionplan"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="funnelevent",
            index=models.Index(fields=["created_at"], name="funnelevent_created_idx"),
        ),
    ]
