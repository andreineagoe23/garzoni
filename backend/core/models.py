from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from ckeditor.fields import RichTextField
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.timezone import now
from celery import shared_task

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points = models.PositiveIntegerField(default=0)
    wants_personalized_path = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    profile_avatar = models.URLField(null=True, blank=True)
    generated_images = models.JSONField(default=list, blank=True) 

    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    email_reminders = models.BooleanField(default=True)
    email_frequency = models.CharField(
        max_length=10,
        choices=FREQUENCY_CHOICES,
        default='daily',
    )

    def add_generated_image(self, image_path):
        """Append an image to the generated_images field."""
        images = self.generated_images or []
        images.append(image_path)
        self.generated_images = images
        self.save()

    def __str__(self):
        return self.user.username

    def add_money(self, amount):
        amount = Decimal(str(amount))
        self.earned_money += amount
        self.save()

    def add_points(self, points):
        self.points += points
        self.save()

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

class Path(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='path_images/', blank=True, null=True)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Path"
        verbose_name_plural = "Paths"

class Course(models.Model):
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="courses", null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to='course_images/', blank=True, null=True)
    
    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"

class Lesson(models.Model):
    EXERCISE_CHOICES = [
        ('drag-and-drop', 'Drag and Drop'),
        ('multiple-choice', 'Multiple Choice'),
        ('quiz', 'Quiz'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    short_description = models.TextField(blank=True)
    detailed_content = RichTextField()
    image = models.ImageField(upload_to='lesson_images/', blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    exercise_type = models.CharField(
        max_length=50, 
        choices=EXERCISE_CHOICES,
        blank=True, 
        null=True
    )
    exercise_data = models.JSONField(blank=True, null=True) 

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    class Meta:
        verbose_name = "Lesson"
        verbose_name_plural = "Lessons"

class Quiz(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="quizzes")
    title = models.CharField(max_length=200)
    question = models.TextField()
    choices = models.JSONField()
    correct_answer = models.CharField(max_length=200)

    def __str__(self):
        question_preview = self.question[:50] if self.question else "No question available"
        return f"{self.title}: {question_preview}"


    class Meta:
        verbose_name = "Quiz"
        verbose_name_plural = "Quizzes"


class UserProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="user_progress")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="progress_courses")
    completed_lessons = models.ManyToManyField(Lesson, through='LessonCompletion', blank=True)
    is_course_complete = models.BooleanField(default=False)
    is_questionnaire_completed = models.BooleanField(default=False)
    course_completed_at = models.DateTimeField(null=True, blank=True)
    last_completed_date = models.DateField(null=True, blank=True)
    streak = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"

    class Meta:
        verbose_name = "User Progress"
        verbose_name_plural = "User Progress"


    def update_streak(self):
        today = timezone.now().date()
        if self.last_completed_date:
            if today > self.last_completed_date:
                self.streak += 1
            else:
                self.streak = 1
        else:
            self.streak = 1
        
        self.last_completed_date = today
        self.save()

    def mark_course_complete(self):
        self.is_course_complete = True
        self.course_completed_at = now()
        self.save()


class LessonCompletion(models.Model):
    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

class QuizCompletion(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'quiz')


class Mission(models.Model):
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

    def __str__(self):
        return f"{self.name} ({self.mission_type})"


class MissionCompletion(models.Model):
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

    def update_progress(self, increment=0, total=100):
        
        if not isinstance(increment, int):
            raise ValueError("increment must be an integer")

        if self.mission.goal_type == "complete_path":
            # Check if the user has completed a path
            user_progress = UserProgress.objects.filter(user=self.user, is_course_complete=True)
            if user_progress.exists():
                self.progress = 100  # Mark as completed
                self.status = 'completed'
                self.completed_at = now()
                self.user.userprofile.add_points(self.mission.points_reward)
        else:
            self.progress = min(self.progress + increment, total)
            if self.progress >= total:
                self.status = 'completed'
                self.completed_at = now()
                self.user.userprofile.add_points(self.mission.points_reward)
            elif self.progress > 0:
                self.status = 'in_progress'
            else:
                self.status = 'not_started'

        self.save()


    @receiver(post_save, sender=User)
    def assign_missions_to_new_user(sender, instance, created, **kwargs):
        """
        Automatically assign daily and weekly missions to newly created users.
        """
        if created:
            # Assign daily missions
            daily_missions = Mission.objects.filter(mission_type="daily")
            for mission in daily_missions:
                MissionCompletion.objects.get_or_create(
                    user=instance,
                    mission=mission,
                    defaults={"progress": 0, "status": "not_started"},
                )
            print(f"Daily missions assigned to new user: {instance.username}")

            # Assign weekly missions
            weekly_missions = Mission.objects.filter(mission_type="weekly")
            for mission in weekly_missions:
                MissionCompletion.objects.get_or_create(
                    user=instance,
                    mission=mission,
                    defaults={"progress": 0, "status": "not_started"},
                )
            print(f"Weekly missions assigned to new user: {instance.username}")

    @shared_task
    def reset_daily_missions():
        today = now().date()
        completions = MissionCompletion.objects.filter(
            mission__mission_type="daily"
        )
        completions.update(progress=0, status="not_started", completed_at=None)
        return f"Daily missions reset at {today}"
        
    @shared_task
    def reset_weekly_missions():
        """
        Reset weekly missions for all users at the start of the week.
        """
        today = now().date()
        completions = MissionCompletion.objects.filter(
            mission__mission_type="weekly"
        )
        completions.update(progress=0, status="not_started", completed_at=None)
        return f"Weekly missions reset at {today}"


class SimulatedSavingsAccount(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def add_to_balance(self, amount):
        self.balance += amount
        self.save()



class Questionnaire(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="questionnaire")
    goal = models.CharField(max_length=255, blank=True, null=True)
    experience = models.CharField(max_length=50, choices=[("Beginner", "Beginner"), ("Intermediate", "Intermediate"), ("Advanced", "Advanced")], blank=True, null=True)
    preferred_style = models.CharField(max_length=50, choices=[("Visual", "Visual"), ("Auditory", "Auditory"), ("Kinesthetic", "Kinesthetic")], blank=True, null=True)

    def __str__(self):
        return f"Questionnaire for {self.user.username}"

class Tool(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=[
        ('basic_finance', 'Basic Finance'),
        ('real_estate', 'Real Estate'),
        ('crypto', 'Crypto'),
        ('forex', 'Forex'),
    ])
    url = models.URLField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)

class Question(models.Model):
    text = models.TextField()
    options = models.JSONField()
    order = models.PositiveIntegerField()

    def __str__(self):
        return self.text

class UserResponse(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_responses", null=True, blank=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.TextField()

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.question.text}"


class PathRecommendation(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    criteria = models.JSONField()

    def __str__(self):
        return self.name

# models.py
class Reward(models.Model):
    REWARD_TYPES = [
        ('shop', 'Shop Item'),
        ('donate', 'Donation Cause')
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField()
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=10, choices=REWARD_TYPES)
    image = models.ImageField(upload_to='rewards/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    donation_organization = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class UserPurchase(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    reward = models.ForeignKey(Reward, on_delete=models.CASCADE)
    purchased_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.reward.name}"