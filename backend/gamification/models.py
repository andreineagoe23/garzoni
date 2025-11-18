from django.db import models
from django.contrib.auth.models import User
from celery import shared_task
from django.utils.timezone import now
from django.utils import timezone

class Badge(models.Model):
    """
    Represents a badge that users can earn by meeting specific criteria. 
    Includes details such as the badge name, description, image, criteria type, threshold, and level.
    """
    BADGE_LEVELS = [
        ('bronze', 'Bronze'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
    ]
    CRITERIA_TYPES = [
        ('lessons_completed', 'Lessons Completed'),
        ('courses_completed', 'Courses Completed'),
        ('streak_days', 'Streak Days'),
        ('points_earned', 'Points Earned'),
        ('missions_completed', 'Missions Completed'),
        ('savings_balance', 'Savings Balance'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='badges/', null=False, blank=False)
    criteria_type = models.CharField(max_length=50, choices=CRITERIA_TYPES)
    threshold = models.IntegerField()
    badge_level = models.CharField(max_length=10, choices=BADGE_LEVELS, default='bronze')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'core_badge'


class UserBadge(models.Model):
    """
    Represents a badge earned by a user. Tracks the user, the badge, and the timestamp when it was earned.
    Ensures that each user can earn a specific badge only once.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='earned_badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'badge')
        db_table = 'core_userbadge'

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"


class Mission(models.Model):
    """
    Represents a mission or task that users can complete to earn rewards or points. 
    Missions can be categorized as daily or weekly and have specific goals such as completing lessons, 
    adding savings, reading finance facts, or completing a learning path.
    """
    MISSION_TYPES = [('daily', 'Daily'), ('weekly', 'Weekly')]
    GOAL_TYPES = [
        ('complete_lesson', 'Complete Lesson'),
        ('add_savings', 'Add Savings'),
        ('read_fact', 'Read Finance Fact'),
        ('complete_path', 'Complete Path'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField()
    points_reward = models.IntegerField()
    mission_type = models.CharField(max_length=10, choices=MISSION_TYPES, default='daily')
    goal_type = models.CharField(max_length=50, choices=GOAL_TYPES, default='complete_lesson')
    goal_reference = models.JSONField(null=True, blank=True)
    fact = models.ForeignKey(
        'finance.FinanceFact',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        limit_choices_to={'is_active': True},
        related_name='missions'
    )

    def __str__(self):
        return f"{self.name} ({self.mission_type})"
        
    class Meta:
        db_table = 'core_mission'


class MissionCompletion(models.Model):
    """
    Tracks the progress and completion status of missions assigned to users. 
    It includes fields for progress, status, and completion timestamp, 
    and provides methods to update progress dynamically.
    """
    user = models.ForeignKey(User, related_name="mission_completions", on_delete=models.CASCADE)
    mission = models.ForeignKey(Mission, related_name="completions", on_delete=models.CASCADE)
    progress = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[
            ('not_started', 'Not Started'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
        ],
        default='not_started'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'core_missioncompletion'

    def update_progress(self, increment=0):
        if self.status == 'completed':
            return

        goal_type = self.mission.goal_type
        mission_type = self.mission.mission_type
        goal_reference = self.mission.goal_reference or {}

        if goal_type == "complete_path":
            # Late import to avoid circular dependency
            from education.models import Path, Course, UserProgress
            
            best_progress = 0

            for path in Path.objects.all():
                total_courses = Course.objects.filter(path=path).count()
                if total_courses == 0:
                    continue

                completed_courses = UserProgress.objects.filter(
                    user=self.user,
                    course__path=path,
                    is_course_complete=True
                ).count()

                path_progress = int((completed_courses / total_courses) * 100)
                if path_progress > best_progress:
                    best_progress = path_progress

            self.progress = best_progress


        elif goal_type == "add_savings":
            target = goal_reference.get('target', 100)
            self.progress = min(self.progress + (increment / target) * 100, 100)

        elif goal_type == "read_fact":
            if mission_type == "daily":
                self.progress = 100
            elif mission_type == "weekly":
                self.progress = min(self.progress + 20, 100)  # 5 facts = 100%

        elif goal_type == "complete_lesson":
            required = goal_reference.get('required_lessons', 1)
            self.progress = min(self.progress + (100 / required), 100)

        # Finalize mission if complete
        if self.progress >= 100:
            self.status = 'completed'
            self.completed_at = timezone.now()

            # Optional: reward badge
            if not UserBadge.objects.filter(user=self.user, badge__name="Mission Master").exists():
                try:
                    badge = Badge.objects.get(name="Mission Master")
                    UserBadge.objects.create(user=self.user, badge=badge)
                except Badge.DoesNotExist:
                    pass

        self.save()

@shared_task
def reset_daily_missions():
    """
    Resets the progress and status of all daily missions at the start of a new day. 
    This ensures that users can attempt daily missions again.
    """
    today = now().date()
    completions = MissionCompletion.objects.filter(
        mission__mission_type="daily"
    )
    completions.update(progress=0, status="not_started", completed_at=None)

@shared_task
def reset_weekly_missions():
    """
    Resets the progress and status of all weekly missions at the start of a new week. 
    This ensures that users can attempt weekly missions again.
    """
    today = now().date()
    completions = MissionCompletion.objects.filter(
        mission__mission_type="weekly"
    )
    completions.update(progress=0, status="not_started", completed_at=None)

