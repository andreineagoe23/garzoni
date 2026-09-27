# Hand-written: currency field default USD -> GBP. Existing rows are unchanged.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budgeting", "0006_alter_linkedaccount_encrypted_access_token_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="linkedaccount",
            name="currency",
            field=models.CharField(default="GBP", max_length=8),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="currency",
            field=models.CharField(default="GBP", max_length=8),
        ),
        migrations.AlterField(
            model_name="budgetenvelope",
            name="currency",
            field=models.CharField(default="GBP", max_length=8),
        ),
        migrations.AlterField(
            model_name="budgetperiodsummary",
            name="currency",
            field=models.CharField(default="GBP", max_length=8),
        ),
    ]
