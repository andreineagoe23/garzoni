from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("education", "0040_periodic_decay_course_mastery"),
    ]

    operations = [
        migrations.AlterField(
            model_name="exercise",
            name="type",
            field=models.CharField(
                choices=[
                    ("drag-and-drop", "Drag and Drop"),
                    ("multiple-choice", "Multiple Choice"),
                    ("numeric", "Numeric"),
                    ("budget-allocation", "Budget Allocation"),
                    ("fill-in-table", "Fill in Table"),
                    ("scenario-simulation", "Scenario Simulation"),
                    ("true-false", "True/False"),
                ],
                max_length=50,
            ),
        ),
    ]
