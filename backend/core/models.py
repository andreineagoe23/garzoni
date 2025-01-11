from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from ckeditor.fields import RichTextField

class UserProfile(models.Model):
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    email_reminders = models.BooleanField(default=True)
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    points = models.PositiveIntegerField(default=0)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    profile_avatar = models.URLField(null=True, blank=True)  # To store avatar URL
    generated_images = models.JSONField(default=list, blank=True) 

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

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Path"
        verbose_name_plural = "Paths"

class Course(models.Model):
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="courses", null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    
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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="progress")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="user_progress")
    completed_lessons = models.ManyToManyField(Lesson, blank=True)
    is_course_complete = models.BooleanField(default=False)
    is_questionnaire_completed = models.BooleanField(default=False)
    
    # Streak fields
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
            # Check if it is a new day
            if today > self.last_completed_date:
                self.streak += 1
            else:
                # Reset streak if the last completed date is not the previous day
                self.streak = 1
        else:
            self.streak = 1
        
        self.last_completed_date = today
        self.save()



class Mission(models.Model):
    MISSION_TYPES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
    ]
    name = models.CharField(max_length=100)
    description = models.TextField()
    points_reward = models.IntegerField()
    mission_type = models.CharField(
        max_length=10, choices=MISSION_TYPES, default='daily'
    )
    goal_type = models.CharField(
        max_length=50, choices=[
            ('complete_lesson', 'Complete Lesson'),
            ('complete_exercise', 'Complete Exercise'),
            ('complete_course', 'Complete Course'),
        ], default='complete_lesson'
    )
    goal_id = models.IntegerField(null=True, blank=True)  # Links to lesson/course ID

    def __str__(self):
        return f"{self.name} ({self.mission_type})"


class MissionCompletion(models.Model):
    user = models.ForeignKey(User, related_name="completed_missions", on_delete=models.CASCADE)
    mission = models.ForeignKey(Mission, related_name="completions", on_delete=models.CASCADE)
    progress = models.IntegerField(default=0)
    status_choices = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(
        max_length=20, choices=status_choices, default='not_started'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    def update_progress(self):
        """Dynamically calculate progress based on user activity."""
        if self.mission.goal_type == 'complete_lesson':
            # Check lessons completed by the user
            user_progress = UserProgress.objects.filter(user=self.user).first()
            if user_progress:
                self.progress = 100 if user_progress.completed_lessons.exists() else 0
        elif self.mission.goal_type == 'complete_exercise':
            # Example logic for exercises
            self.progress = 100 if some_exercise_completion_logic() else 0
        elif self.mission.goal_type == 'complete_course':
            # Calculate progress for a course
            user_progress = UserProgress.objects.filter(
                user=self.user, course_id=self.mission.goal_id
            ).first()
            if user_progress:
                total_lessons = user_progress.course.lessons.count()
                completed_lessons = user_progress.completed_lessons.count()
                self.progress = int((completed_lessons / total_lessons) * 100) if total_lessons > 0 else 0
        
        # Update status
        if self.progress >= 100:
            self.status = 'completed'
            self.completed_at = timezone.now()
        elif self.progress > 0:
            self.status = 'in_progress'
        else:
            self.status = 'not_started'

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
