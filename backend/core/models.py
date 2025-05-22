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
import uuid

class UserProfile(models.Model):
    """
    The UserProfile model extends the default User model with additional attributes like earned money, points, 
    referral details, and preferences such as dark mode and email reminders. It also tracks user activity 
    through streaks and last completed dates, providing methods to update these attributes dynamically.
    """
    REMINDER_CHOICES = [
        ('none', 'No Reminders'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly')
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points = models.IntegerField(default=0)
    profile_avatar = models.URLField(null=True, blank=True)
    recommended_courses = models.JSONField(default=list, blank=True)
    referral_code = models.CharField(
        max_length=20,
        unique=True,
        blank=False,
        null=True,
    )
    referral_points = models.PositiveIntegerField(default=0)
    dark_mode = models.BooleanField(default=False)
    has_paid = models.BooleanField(default=False)
    stripe_payment_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True
    )
    email_reminder_preference = models.CharField(
        max_length=10,
        choices=REMINDER_CHOICES,
        default='none'
    )
    streak = models.IntegerField(default=0)
    last_completed_date = models.DateField(null=True, blank=True)
    last_login_date = models.DateField(null=True, blank=True)
    last_reminder_sent = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.user.username

    def add_money(self, amount):
        amount = Decimal(str(amount))
        self.earned_money += amount
        self.save()

    def add_points(self, points):
        self.points += points
        self.save()

    def update_streak(self):
        today = timezone.now().date()

        if self.last_completed_date == today:
            return

        if self.last_completed_date:
            difference = (today - self.last_completed_date).days
            if difference == 1:
                self.streak += 1
            else:
                self.streak = 1
        else:
            self.streak = 1

        self.last_completed_date = today
        self.save()

    def save(self, *args, **kwargs):
        if not self.referral_code or self.referral_code.strip() == '':
            self.referral_code = None
        if not self.referral_code:
            self.referral_code = uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"


class Path(models.Model):
    """
    The Path model represents a learning path that groups related courses together. 
    It includes a title, description, and an optional image to visually represent the path.
    """
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='path_images/', blank=True, null=True)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Path"
        verbose_name_plural = "Paths"

class Course(models.Model):
    """
    The Course model represents an educational course that belongs to a specific Path. 
    It includes details such as the course title, description, image, and its active status. 
    The model also supports ordering of courses and ensures that they are associated with a Path.
    """
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="courses", null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to='course_images/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title

class Lesson(models.Model):
    """
    The Lesson model represents an individual lesson within a course. 
    It includes details such as the lesson title, description, content, 
    associated media (image and video), and optional exercises.
    """
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

class LessonSection(models.Model):
    # Represents a section within a lesson, which can contain text, video, or interactive exercises.
    CONTENT_TYPES = [
        ('text', 'Text Content'),
        ('video', 'Video'),
        ('exercise', 'Interactive Exercise'),
    ]

    EXERCISE_TYPES = [
        ('drag-and-drop', 'Drag and Drop'),
        ('multiple-choice', 'Multiple Choice'),
        ('budget-allocation', 'Budget Allocation'),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='sections')
    order = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, default='text')
    text_content = RichTextField(blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    exercise_type = models.CharField(max_length=50, choices=EXERCISE_TYPES, blank=True, null=True)
    exercise_data = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ['order']
        unique_together = ('lesson', 'order')


class UserProgress(models.Model):
    """
    The UserProgress model tracks a user's progress in a course, including completed lessons, sections, 
    and course completion status. It also provides methods to update user streaks and mark a course as complete.
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="user_progress")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="progress_courses")
    completed_lessons = models.ManyToManyField(Lesson, through='LessonCompletion', blank=True)
    is_course_complete = models.BooleanField(default=False)
    is_questionnaire_completed = models.BooleanField(default=False)
    course_completed_at = models.DateTimeField(null=True, blank=True)
    completed_sections = models.ManyToManyField(LessonSection, through='SectionCompletion', blank=True)
    last_completed_date = models.DateField(null=True, blank=True)
    streak = models.PositiveIntegerField(default=0)

    def __str__(self):
        user_str = self.user.username if self.user else "Unknown User"
        course_str = self.course.title if self.course else "Unknown Course"
        return f"{user_str} - {course_str}"

    class Meta:
        verbose_name = "User Progress"
        verbose_name_plural = "User Progress"

    def update_streak(self):
        """Update the streak for the user progress."""
        today = timezone.localtime().date()
        
        if self.last_completed_date == today:
            return
        
        if self.last_completed_date:
            difference = (today - self.last_completed_date).days
            if difference == 1:  # Consecutive day
                self.streak += 1
            elif difference > 1:  # Streak broken
                self.streak = 1
        else:
            self.streak = 1
        
        self.last_completed_date = today
        self.save()

        # Also update the global streak in the UserProfile
        self.user.profile.update_streak()

    def mark_course_complete(self):
        self.is_course_complete = True
        from core.utils import check_and_award_badge
        check_and_award_badge(self.user, 'courses_completed')
        self.save()

class LessonCompletion(models.Model):
    """
    Tracks the completion of individual lessons by a user within a course. 
    It links the user's progress to the specific lesson and records the completion timestamp.
    """
    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

class SectionCompletion(models.Model):
    """
    Tracks the completion of individual sections within a lesson by a user. 
    It links the user's progress to the specific section and records the completion timestamp.
    """
    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    section = models.ForeignKey(LessonSection, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

class Quiz(models.Model):
    """
    The Quiz model represents a quiz associated with a course. 
    It includes the quiz title, question, multiple choices, and the correct answer.
    """
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


class QuizCompletion(models.Model):
    """
    The QuizCompletion model tracks the completion of quizzes by users. 
    It links a user to a specific quiz and records the timestamp of completion.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'quiz')

class FinanceFact(models.Model):
    """
    Represents a financial fact that can be displayed to users. 
    Each fact belongs to a category and can be marked as active or inactive.
    """
    text = models.TextField()
    category = models.CharField(max_length=50, default="General")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:50] + "..."

class UserFactProgress(models.Model):
    """
    Tracks the progress of users in reading financial facts. 
    Links a user to a specific fact and records the timestamp when it was read.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    fact = models.ForeignKey(FinanceFact, on_delete=models.CASCADE)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'fact')



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
        FinanceFact,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        limit_choices_to={'is_active': True}
    )

    def __str__(self):
        return f"{self.name} ({self.mission_type})"


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

    def update_progress(self, increment=0):
        if self.status == 'completed':
            return

        goal_type = self.mission.goal_type
        mission_type = self.mission.mission_type
        goal_reference = self.mission.goal_reference or {}

        if goal_type == "complete_path":
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
            from .models import UserBadge, Badge
            if not UserBadge.objects.filter(user=self.user, badge__name="Mission Master").exists():
                try:
                    badge = Badge.objects.get(name="Mission Master")
                    UserBadge.objects.create(user=self.user, badge=badge)
                except Badge.DoesNotExist:
                    pass

        self.save()


    @receiver(post_save, sender=User)
    def assign_missions_to_new_user(sender, instance, created, **kwargs):
        if created:
            for mission_type in ["daily", "weekly"]:
                missions = Mission.objects.filter(mission_type=mission_type)
                for mission in missions:
                    MissionCompletion.objects.get_or_create(
                        user=instance,
                        mission=mission,
                        defaults={"progress": 0, "status": "not_started"},
                )

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


class SimulatedSavingsAccount(models.Model):
    """
    Represents a simulated savings account for a user, allowing them to track and manage their virtual balance.
    Provides functionality to add funds to the balance.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def add_to_balance(self, amount):
        self.balance += amount
        self.save()


class Questionnaire(models.Model):
    """
    Stores user-specific questionnaire data, including their financial goals, experience level, 
    and preferred learning style. This helps in personalizing the user experience.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="questionnaire")
    goal = models.CharField(max_length=255, blank=True, null=True)
    experience = models.CharField(max_length=50, choices=[("Beginner", "Beginner"), ("Intermediate", "Intermediate"), ("Advanced", "Advanced")], blank=True, null=True)
    preferred_style = models.CharField(max_length=50, choices=[("Visual", "Visual"), ("Auditory", "Auditory"), ("Kinesthetic", "Kinesthetic")], blank=True, null=True)

    def __str__(self):
        return f"Questionnaire for {self.user.username}"

class Tool(models.Model):
    """
    Represents a financial tool or resource that users can access. 
    Each tool is categorized and includes a name, description, URL, and optional icon.
    """
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
    """
    Represents a question used for knowledge checks, user preferences, or budget allocation. 
    Each question includes text, type, options, and an optional explanation, and can be ordered or categorized.
    """
    QUESTION_TYPES = [
        ('knowledge_check', 'Knowledge Check'),
        ('preference_scale', 'Preference Scale'),
        ('budget_allocation', 'Budget Allocation')
    ]

    text = models.TextField()
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    options = models.JSONField()
    explanation = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    category = models.CharField(max_length=50, default="General")

class PollResponse(models.Model):
    """
    Represents a response to a poll question. Each response is linked to a specific question 
    and includes the user's answer along with the timestamp of when the response was submitted.
    """
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.CharField(max_length=200)
    responded_at = models.DateTimeField(auto_now_add=True)

class UserResponse(models.Model):
    """
    Tracks individual user responses to questions. Each response is associated with a user (optional), 
    a specific question, and the user's answer. This model helps in analyzing user preferences or feedback.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_responses", null=True, blank=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.TextField()

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.question.text}"


class PathRecommendation(models.Model):
    """
    Represents a recommended learning path for users based on specific criteria. 
    Includes a name, description, and criteria for recommendation.
    """
    name = models.CharField(max_length=100)
    description = models.TextField()
    criteria = models.JSONField()

    def __str__(self):
        return self.name

class Reward(models.Model):
    """
    Represents a reward that users can purchase or donate towards. 
    Rewards can be shop items or donation causes, with details like cost, type, and optional image.
    """
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
    """
    Represents a record of a user purchasing a reward. 
    Tracks the user, the reward purchased, and the timestamp of the purchase.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    reward = models.ForeignKey(Reward, on_delete=models.CASCADE)
    purchased_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.reward.name}"


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

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"


class Referral(models.Model):
    """
    Tracks referrals made by users. Links the referrer to the referred user and records the timestamp of the referral.
    Ensures that each referred user is linked to only one referrer.
    """
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrals_made')
    referred_user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_received')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.referrer.username} -> {self.referred_user.username}"


    referral_code = models.CharField(max_length=20, unique=True, blank=True)
    referral_points = models.PositiveIntegerField(default=0)


    @receiver(post_save, sender=User)
    def create_user_profile(sender, instance, created, **kwargs):
        """
        Signal handler that automatically creates a UserProfile for a newly created User.
        Generates a unique referral code for the user profile upon creation.
        """
        if created:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            if created:
                profile.referral_code = uuid.uuid4().hex[:8].upper()
                profile.save()


class FriendRequest(models.Model):
    """
    Represents a friend request between two users. Tracks the sender, receiver, 
    the status of the request (pending, accepted, or rejected), and the timestamp of creation.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username}"


class Exercise(models.Model):
    """
    Represents an interactive exercise for users to complete. Includes the exercise type, 
    question, structured data for the exercise, correct answer, category, difficulty level, and creation timestamp.
    """
    EXERCISE_TYPES = [
        ('drag-and-drop', 'Drag and Drop'),
        ('multiple-choice', 'Multiple Choice'),
        ('budget-allocation', 'Budget Allocation'),
    ]

    type = models.CharField(max_length=50, choices=EXERCISE_TYPES)
    question = models.TextField()
    exercise_data = models.JSONField(help_text="Structured data based on exercise type")
    correct_answer = models.JSONField(help_text="Correct answer structure")
    category = models.CharField(max_length=100, default="General")
    difficulty = models.CharField(max_length=20, choices=[
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced')
    ], default='beginner')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} Exercise - {self.category}"

class UserExerciseProgress(models.Model):
    """
    Tracks the progress of a user on a specific exercise. 
    Includes details such as whether the exercise is completed, the number of attempts, 
    the last attempt timestamp, and the user's answer.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt = models.DateTimeField(auto_now=True)
    user_answer = models.JSONField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'exercise')


class ExerciseCompletion(models.Model):
    """
    Records the completion of an exercise by a user, optionally within a specific lesson section. 
    Tracks the completion timestamp, number of attempts, and the user's answer.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    exercise = models.ForeignKey('Exercise', on_delete=models.CASCADE)
    section = models.ForeignKey(LessonSection, on_delete=models.CASCADE, null=True)
    completed_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveIntegerField(default=0)
    user_answer = models.JSONField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'exercise', 'section')

class StripePayment(models.Model):
    """
    Represents a record of a payment made by a user through Stripe. 
    Tracks the user, payment ID, amount, currency, and the timestamp of creation.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    stripe_payment_id = models.CharField(max_length=255, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.amount} {self.currency}"

class FAQ(models.Model):
    category = models.CharField(max_length=100)
    question = models.TextField()
    answer = models.TextField()
    is_active = models.BooleanField(default=True)
    helpful_count = models.PositiveIntegerField(default=0)
    not_helpful_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.question

class ContactMessage(models.Model):
    email = models.EmailField()
    topic = models.CharField(max_length=100)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.email} - {self.topic}"
    
