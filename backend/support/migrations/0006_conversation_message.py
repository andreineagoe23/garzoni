from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0005_alter_supportentry_table_alter_supportfeedback_table"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("chat", "Chat"),
                            ("exercise_hint", "Exercise Hint"),
                            ("exercise_explain", "Exercise Explain"),
                            ("voice", "Voice"),
                            ("coach_brief", "Coach Brief"),
                        ],
                        default="chat",
                        max_length=32,
                    ),
                ),
                ("summary", models.TextField(blank=True, default="")),
                ("total_tokens", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_conversations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "core_ai_conversation",
            },
        ),
        migrations.AddIndex(
            model_name="conversation",
            index=models.Index(
                fields=["user", "source", "-updated_at"],
                name="conv_user_source_idx",
            ),
        ),
        migrations.CreateModel(
            name="Message",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("system", "System"),
                            ("user", "User"),
                            ("assistant", "Assistant"),
                            ("tool", "Tool"),
                        ],
                        max_length=16,
                    ),
                ),
                ("content", models.TextField()),
                ("tool_call_id", models.CharField(blank=True, default="", max_length=64)),
                ("tool_name", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="support.conversation",
                    ),
                ),
            ],
            options={
                "db_table": "core_ai_message",
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="message",
            index=models.Index(
                fields=["conversation", "created_at"],
                name="msg_conv_created_idx",
            ),
        ),
    ]
