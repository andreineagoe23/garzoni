from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0011_stripe_webhook_event"),
    ]

    operations = [
        migrations.AddField(
            model_name="funnelevent",
            name="platform",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddIndex(
            model_name="funnelevent",
            index=models.Index(
                fields=["platform", "created_at"],
                name="finance_fun_platfor_idx",
            ),
        ),
    ]
