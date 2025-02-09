from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprogress',
            name='course_completed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]