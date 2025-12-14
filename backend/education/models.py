from django.db import models
from django.contrib.auth.models import User
from django_ckeditor_5.fields import CKEditor5Field
from django.utils import timezone
from datetime import timedelta

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
        db_table = 'core_path'

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
        db_table = 'core_course'

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
    detailed_content = CKEditor5Field(config_name="extends")
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
        db_table = 'core_lesson'

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
        ('numeric', 'Numeric'),
        ('budget-allocation', 'Budget Allocation'),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='sections')
    order = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, default='text')
    text_content = CKEditor5Field(config_name="extends", blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    exercise_type = models.CharField(max_length=50, choices=EXERCISE_TYPES, blank=True, null=True)
    exercise_data = models.JSONField(blank=True, null=True)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="edited_lesson_sections",
    )

    class Meta:
        ordering = ['order']
        unique_together = ('lesson', 'order')
        db_table = 'core_lessonsection'


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
    # Persist immersive course/lesson flow position (section index within flattened flow)
    flow_current_index = models.PositiveIntegerField(default=0)
    flow_updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        user_str = self.user.username if self.user else "Unknown User"
        course_str = self.course.title if self.course else "Unknown Course"
        return f"{user_str} - {course_str}"

    class Meta:
        verbose_name = "User Progress"
        verbose_name_plural = "User Progress"
        db_table = 'core_userprogress'

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
        if hasattr(self.user, 'profile'):
            self.user.profile.update_streak()

    def mark_course_complete(self):
        self.is_course_complete = True
        # Badge checking is now in gamification.utils.check_and_award_badge
        # Can be called from gamification app when needed
        self.save()

class LessonCompletion(models.Model):
    """
    Tracks the completion of individual lessons by a user within a course. 
    It links the user's progress to the specific lesson and records the completion timestamp.
    """
    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_lessoncompletion'

class SectionCompletion(models.Model):
    """
    Tracks the completion of individual sections within a lesson by a user. 
    It links the user's progress to the specific section and records the completion timestamp.
    """
    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    section = models.ForeignKey(LessonSection, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_sectioncompletion'


class EducationAuditLog(models.Model):
    """Simple audit log for administrative changes within the education domain."""

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="education_audit_logs",
    )
    action = models.CharField(max_length=255)
    target_type = models.CharField(max_length=100)
    target_id = models.PositiveIntegerField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'education_audit_log'

    def __str__(self):
        return f"{self.action} on {self.target_type} {self.target_id} by {self.user or 'system'}"

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
        db_table = 'core_quiz'


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
        db_table = 'core_quizcompletion'

class Exercise(models.Model):
    """
    Represents an interactive exercise for users to complete. Includes the exercise type, 
    question, structured data for the exercise, correct answer, category, difficulty level, and creation timestamp.
    """
    EXERCISE_TYPES = [
        ('drag-and-drop', 'Drag and Drop'),
        ('multiple-choice', 'Multiple Choice'),
        ('numeric', 'Numeric'),
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
    version = models.PositiveIntegerField(default=1, help_text="Immutable version for published exercises")
    is_published = models.BooleanField(default=False)
    misconception_tags = models.JSONField(default=list, blank=True)
    error_patterns = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} Exercise - {self.category}"
        
    class Meta:
        db_table = 'core_exercise'


class MultipleChoiceChoice(models.Model):
    """Discrete choice rows for multiple-choice exercises."""

    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name="multiple_choice_choices"
    )
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    is_correct = models.BooleanField(default=False)
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ['order', 'id']
        db_table = 'core_multiplechoicechoice'

    def __str__(self):
        return f"Choice {self.order + 1} for {self.exercise_id}"


class Mastery(models.Model):
    """Tracks spaced-repetition style mastery for a user/skill pair."""

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    skill = models.CharField(max_length=100)
    proficiency = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField(default=timezone.now)
    last_reviewed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'skill')
        db_table = 'core_mastery'

    def bump(self, correct: bool, confidence: str | None = None, hints_used: int = 0, attempts: int = 1):
        """Simple Leitner-style scheduler with confidence + hint shaping.

        Correct + high confidence gives a bigger jump; low confidence tempers gains.
        Hints diminish gains. Wrong answers demote and force an immediate review.
        Repeated wrong attempts drop to the bottom bucket.
        """

        confidence_bonus = {
            'low': -3,
            'medium': 0,
            'high': 6,
        }.get(confidence or 'medium', 0)
        hint_penalty = min(10, max(0, hints_used) * 2)

        if correct:
            gain = 12 + confidence_bonus - hint_penalty
            self.proficiency = max(0, min(100, self.proficiency + gain))
        else:
            drop = 15 if attempts < 3 else 30
            self.proficiency = max(0, self.proficiency - drop)

        if not correct and attempts >= 3:
            self.proficiency = 0

        # Map proficiency bands to a light spacing schedule
        band = max(0, min(4, self.proficiency // 20))
        intervals = [1, 1, 2, 4, 7]
        days = intervals[band]

        self.due_at = timezone.now() + timedelta(days=days) if correct else timezone.now()
        self.save()

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
        db_table = 'core_userexerciseprogress'


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
        db_table = 'core_exercisecompletion'


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
        
    class Meta:
        db_table = 'core_questionnaire'

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
    
    class Meta:
        db_table = 'core_question'

class PollResponse(models.Model):
    """
    Represents a response to a poll question. Each response is linked to a specific question 
    and includes the user's answer along with the timestamp of when the response was submitted.
    """
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.CharField(max_length=200)
    responded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'core_pollresponse'

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
        
    class Meta:
        db_table = 'core_userresponse'


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
        
    class Meta:
        db_table = 'core_pathrecommendation'

