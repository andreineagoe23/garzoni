from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0010_add_previous_price_to_portfolio_entry"),
    ]

    operations = [
        migrations.CreateModel(
            name="StripeWebhookEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("event_id", models.CharField(max_length=255, unique=True)),
                ("event_type", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["created_at"],
                        name="finance_str_created_idx",
                    )
                ],
            },
        ),
    ]
