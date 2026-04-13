from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0016_userprofile_apple_sub"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="profile_avatar",
            field=models.URLField(blank=True, max_length=2000, null=True),
        ),
    ]
