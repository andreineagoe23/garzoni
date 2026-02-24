# Generated manually for portfolio asset type choices and symbol length

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0007_remove_financialgoal_uniq_user_goal_name_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="portfolioentry",
            name="asset_type",
            field=models.CharField(
                choices=[
                    ("stock", "Stock"),
                    ("crypto", "Crypto"),
                    ("etf", "ETF"),
                    ("bond", "Bond"),
                    ("fund", "Fund"),
                    ("commodity", "Commodity"),
                    ("real_estate", "Real estate"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="portfolioentry",
            name="symbol",
            field=models.CharField(max_length=32),
        ),
    ]
