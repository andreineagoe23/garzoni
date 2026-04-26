from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0009_add_is_paper_trade_to_portfolio_entry"),
    ]

    operations = [
        migrations.AddField(
            model_name="portfolioentry",
            name="previous_price",
            field=models.DecimalField(
                blank=True, decimal_places=8, max_digits=20, null=True
            ),
        ),
    ]
