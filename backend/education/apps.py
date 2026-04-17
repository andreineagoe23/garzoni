from django.apps import AppConfig


class EducationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "education"
    verbose_name = "Education"

    def ready(self):
        import education.signals  # noqa: F401
