from celery import shared_task
from django.core.mail import send_mail
from django.contrib.auth.models import User

@shared_task
def send_email_reminders():
    users = User.objects.filter(userprofile__email_reminders=True)
    for user in users:
        send_mail(
            "Reminder from Monevo",
            "Don't forget to check your progress on Monevo!",
            "noreply@monevo.com",
            [user.email],
            fail_silently=False,
        )
