from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuizCompletion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('completed_at', models.DateTimeField(auto_now_add=True)),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.quiz')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'quiz')},
            },
        ),
    ]