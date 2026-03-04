from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0022_lessonsection_source_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentReleaseState",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("key", models.CharField(max_length=64, unique=True)),
                ("version", models.CharField(max_length=64)),
                ("applied_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "education_content_release_state",
            },
        ),
    ]
