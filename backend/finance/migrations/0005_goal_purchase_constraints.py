from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0004_funnelevent_created_idx"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="financialgoal",
            constraint=models.UniqueConstraint(
                fields=["user", "goal_name"], name="uniq_user_goal_name"
            ),
        ),
        migrations.AddConstraint(
            model_name="userpurchase",
            constraint=models.UniqueConstraint(
                fields=["user", "reward"], name="uniq_user_reward_purchase"
            ),
        ),
    ]
