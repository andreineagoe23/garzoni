from django.core.exceptions import ValidationError
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

    ACCESS_TIER_CHOICES = [
        ("starter", "Starter"),
        ("plus", "Plus"),
        ("pro", "Pro"),
    ]

    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to="path_images/", blank=True, null=True)
    access_tier = models.CharField(
        max_length=16,
        choices=ACCESS_TIER_CHOICES,
        default="starter",
        help_text="Minimum subscription tier required to access this path.",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Path"
        verbose_name_plural = "Paths"
        db_table = "core_path"
        ordering = ["sort_order", "id"]


class Course(models.Model):
    """
    The Course model represents an educational course that belongs to a specific Path.
    It includes details such as the course title, description, image, and its active status.
    The model also supports ordering of courses and ensures that they are associated with a Path.
    """

    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="courses", null=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to="course_images/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        db_table = "core_course"

    def __str__(self):
        return self.title


class Lesson(models.Model):
    """
    The Lesson model represents an individual lesson within a course.
    It includes details such as the lesson title, description, content,
    associated media (image and video), and optional exercises.
    """

    EXERCISE_CHOICES = [
        ("drag-and-drop", "Drag and Drop"),
        ("multiple-choice", "Multiple Choice"),
        ("quiz", "Quiz"),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    short_description = models.TextField(blank=True)
    detailed_content = CKEditor5Field(config_name="extends")
    image = models.ImageField(upload_to="lesson_images/", blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    exercise_type = models.CharField(max_length=50, choices=EXERCISE_CHOICES, blank=True, null=True)
    exercise_data = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    class Meta:
        verbose_name = "Lesson"
        verbose_name_plural = "Lessons"
        db_table = "core_lesson"


class LessonSection(models.Model):
    # Represents a section within a lesson, which can contain text, video, or interactive exercises.
    CONTENT_TYPES = [
        ("text", "Text Content"),
        ("video", "Video"),
        ("exercise", "Interactive Exercise"),
    ]

    EXERCISE_TYPES = [
        ("drag-and-drop", "Drag and Drop"),
        ("multiple-choice", "Multiple Choice"),
        ("numeric", "Numeric"),
        ("budget-allocation", "Budget Allocation"),
        ("fill-in-table", "Fill In Table"),
        ("scenario-simulation", "Scenario Simulation"),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    order = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, default="text")
    text_content = CKEditor5Field(config_name="extends", blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    exercise_type = models.CharField(max_length=50, choices=EXERCISE_TYPES, blank=True, null=True)
    exercise_data = models.JSONField(blank=True, null=True)
    source_label = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional short attribution or source name for this section's content.",
    )
    source_url = models.URLField(
        blank=True,
        null=True,
        help_text="Optional link to the primary source or reference for this section.",
    )
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
        ordering = ["order"]
        unique_together = ("lesson", "order")
        db_table = "core_lessonsection"


class UserProgress(models.Model):
    """
    The UserProgress model tracks a user's progress in a course, including completed lessons, sections,
    and course completion status. It also provides methods to update user streaks and mark a course as complete.
    """

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="user_progress"
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="progress_courses")
    completed_lessons = models.ManyToManyField(Lesson, through="LessonCompletion", blank=True)
    is_course_complete = models.BooleanField(default=False)
    is_questionnaire_completed = models.BooleanField(default=False)
    course_completed_at = models.DateTimeField(null=True, blank=True)
    completed_sections = models.ManyToManyField(
        LessonSection, through="SectionCompletion", blank=True
    )
    last_course_activity_date = models.DateField(null=True, blank=True)
    learning_session_count = models.PositiveIntegerField(
        default=0,
        help_text="Consecutive days of activity on this course (not the global streak).",
    )
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
        db_table = "core_userprogress"

    def update_streak(self):
        """Update per-course activity counters and bump the canonical profile streak."""
        if not self.user_id:
            return
        today = timezone.localtime().date()

        if self.last_course_activity_date == today:
            if hasattr(self.user, "profile"):
                self.user.profile.update_streak()
            return

        if self.last_course_activity_date:
            difference = (today - self.last_course_activity_date).days
            if difference == 1:
                self.learning_session_count += 1
            elif difference > 1:
                self.learning_session_count = 1
        else:
            self.learning_session_count = 1

        self.last_course_activity_date = today
        self.save(update_fields=["learning_session_count", "last_course_activity_date"])

        if hasattr(self.user, "profile"):
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
        db_table = "core_lessoncompletion"


class SectionCompletion(models.Model):
    """
    Tracks the completion of individual sections within a lesson by a user.
    It links the user's progress to the specific section and records the completion timestamp.
    """

    user_progress = models.ForeignKey(UserProgress, on_delete=models.CASCADE)
    section = models.ForeignKey(LessonSection, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_sectioncompletion"


class DailyActivityLog(models.Model):
    ACTIVITY_TYPES = [
        ("section", "Section"),
        ("lesson", "Lesson"),
        ("exercise", "Exercise"),
        ("quiz", "Quiz"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    object_id = models.PositiveIntegerField()
    course = models.ForeignKey(Course, null=True, on_delete=models.SET_NULL)
    date = models.DateField(default=timezone.localdate)

    class Meta:
        db_table = "education_daily_activity_log"
        unique_together = ("user", "activity_type", "object_id")
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["user", "activity_type", "date"]),
        ]


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
        ordering = ["-created_at"]
        db_table = "education_audit_log"

    def __str__(self):
        return f"{self.action} on {self.target_type} {self.target_id} by {self.user or 'system'}"


class ContentReleaseState(models.Model):
    """
    Tracks idempotent, versioned education-content rollouts applied in-place.
    """

    key = models.CharField(max_length=64, unique=True)
    version = models.CharField(max_length=64)
    applied_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "education_content_release_state"

    def __str__(self):
        return f"{self.key}:{self.version}"


class Quiz(models.Model):
    """
    The Quiz model represents a quiz associated with a course.
    It includes the quiz title, question, multiple choices, and the correct answer.

    Lesson checkpoints (Duolingo-style) reuse this model: rows with ``source_lesson_section``
    set are auto-built from that section's multiple-choice exercise and are excluded from
    the end-of-course quiz list.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="quizzes")
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="checkpoint_quizzes",
        help_text="When set, this quiz belongs to a lesson checkpoint (not the course capstone).",
    )
    source_lesson_section = models.OneToOneField(
        LessonSection,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sourced_checkpoint_quiz",
        help_text="Lesson section this checkpoint question was materialized from.",
    )
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
        db_table = "core_quiz"


class QuizCompletion(models.Model):
    """
    The QuizCompletion model tracks the completion of quizzes by users.
    It links a user to a specific quiz and records the timestamp of completion.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "quiz")
        db_table = "core_quizcompletion"


class ExerciseManager(models.Manager):
    """Manager that omits columns that may be missing (e.g. version, is_published) so older DBs still work."""

    SAFE_FIELDS = (
        "id",
        "type",
        "question",
        "exercise_data",
        "correct_answer",
        "category",
        "difficulty",
        "misconception_tags",
        "error_patterns",
        "created_at",
        "is_published",
    )

    def get_queryset(self):
        return super().get_queryset().only(*self.SAFE_FIELDS)


class Exercise(models.Model):
    """
    Represents an interactive exercise for users to complete. Includes the exercise type,
    question, structured data for the exercise, correct answer, category, difficulty level, and creation timestamp.
    """

    EXERCISE_TYPES = [
        ("drag-and-drop", "Drag and Drop"),
        ("multiple-choice", "Multiple Choice"),
        ("numeric", "Numeric"),
        ("budget-allocation", "Budget Allocation"),
    ]

    type = models.CharField(max_length=50, choices=EXERCISE_TYPES)
    question = models.TextField()
    exercise_data = models.JSONField(help_text="Structured data based on exercise type")
    correct_answer = models.JSONField(help_text="Correct answer structure")
    category = models.CharField(max_length=100, default="General")
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ("beginner", "Beginner"),
            ("intermediate", "Intermediate"),
            ("advanced", "Advanced"),
        ],
        default="beginner",
    )
    version = models.PositiveIntegerField(
        default=1, help_text="Immutable version for published exercises"
    )
    is_published = models.BooleanField(default=False)
    misconception_tags = models.JSONField(default=list, blank=True)
    error_patterns = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ExerciseManager()

    def clean(self):
        super().clean()
        base_q = (self.question or "").strip()
        if self.is_published:
            if base_q:
                return
            if (
                self.pk
                and self.translations.exclude(question__isnull=True).exclude(question="").exists()
            ):
                return
            raise ValidationError(
                {
                    "question": (
                        "Published exercises must have question text, or at least one "
                        "translation with a non-empty question."
                    )
                }
            )

    def __str__(self):
        return f"{self.type} Exercise - {self.category}"

    class Meta:
        db_table = "core_exercise"


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
        ordering = ["order", "id"]
        db_table = "core_multiplechoicechoice"

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
        unique_together = ("user", "skill")
        db_table = "core_mastery"

    def bump(
        self,
        correct: bool,
        confidence: str | None = None,
        hints_used: int = 0,
        attempts: int = 1,
    ):
        """Simple Leitner-style scheduler with confidence + hint shaping.

        Correct + high confidence gives a bigger jump; low confidence tempers gains.
        Hints diminish gains. Wrong answers demote and force an immediate review.
        Repeated wrong attempts drop to the bottom bucket.
        """

        confidence_bonus = {
            "low": -3,
            "medium": 0,
            "high": 6,
        }.get(confidence or "medium", 0)
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
        unique_together = ("user", "exercise")
        db_table = "core_userexerciseprogress"


class ExerciseCompletion(models.Model):
    """
    Records the completion of an exercise by a user, optionally within a specific lesson section.
    Tracks the completion timestamp, number of attempts, and the user's answer.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    exercise = models.ForeignKey("Exercise", on_delete=models.CASCADE)
    section = models.ForeignKey(LessonSection, on_delete=models.CASCADE, null=True)
    completed_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveIntegerField(default=0)
    user_answer = models.JSONField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "exercise", "section")
        db_table = "core_exercisecompletion"


class Questionnaire(models.Model):
    """
    Stores user-specific questionnaire data, including their financial goals, experience level,
    and preferred learning style. This helps in personalizing the user experience.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="questionnaire")
    goal = models.CharField(max_length=255, blank=True, null=True)
    experience = models.CharField(
        max_length=50,
        choices=[
            ("Beginner", "Beginner"),
            ("Intermediate", "Intermediate"),
            ("Advanced", "Advanced"),
        ],
        blank=True,
        null=True,
    )
    preferred_style = models.CharField(
        max_length=50,
        choices=[
            ("Visual", "Visual"),
            ("Auditory", "Auditory"),
            ("Kinesthetic", "Kinesthetic"),
        ],
        blank=True,
        null=True,
    )

    def __str__(self):
        return f"Questionnaire for {self.user.username}"

    class Meta:
        db_table = "core_questionnaire"


class Question(models.Model):
    """
    Represents a question used for knowledge checks, user preferences, or budget allocation.
    Each question includes text, type, options, and an optional explanation, and can be ordered or categorized.
    """

    QUESTION_TYPES = [
        ("knowledge_check", "Knowledge Check"),
        ("preference_scale", "Preference Scale"),
        ("budget_allocation", "Budget Allocation"),
    ]

    text = models.TextField()
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    options = models.JSONField()
    explanation = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    category = models.CharField(max_length=50, default="General")

    class Meta:
        db_table = "core_question"


class PollResponse(models.Model):
    """
    Represents a response to a poll question. Each response is linked to a specific question
    and includes the user's answer along with the timestamp of when the response was submitted.
    """

    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.CharField(max_length=200)
    responded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_pollresponse"


class UserResponse(models.Model):
    """
    Tracks individual user responses to questions. Each response is associated with a user (optional),
    a specific question, and the user's answer. This model helps in analyzing user preferences or feedback.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_responses",
        null=True,
        blank=True,
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.TextField()

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.question.text}"

    class Meta:
        db_table = "core_userresponse"


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
        db_table = "core_pathrecommendation"


# ---- Translation models (one row per parent per language; canonical content is in the main model as fallback) ----


class PathTranslation(models.Model):
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=10, db_index=True)
    title = models.CharField(max_length=100)
    description = models.TextField()
    source_hash = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Hash of the English source at translation time, used for staleness detection.",
    )

    class Meta:
        db_table = "education_path_translation"
        unique_together = [("path", "language")]


class CourseTranslation(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=10, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    source_hash = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Hash of the English source at translation time, used for staleness detection.",
    )

    class Meta:
        db_table = "education_course_translation"
        unique_together = [("course", "language")]


class LessonTranslation(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=10, db_index=True)
    title = models.CharField(max_length=200)
    short_description = models.TextField(blank=True)
    detailed_content = models.TextField(blank=True)
    source_hash = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Hash of the English source at translation time, used for staleness detection.",
    )

    class Meta:
        db_table = "education_lesson_translation"
        unique_together = [("lesson", "language")]


class LessonSectionTranslation(models.Model):
    section = models.ForeignKey(
        LessonSection, on_delete=models.CASCADE, related_name="translations"
    )
    language = models.CharField(max_length=10, db_index=True)
    title = models.CharField(max_length=200)
    text_content = models.TextField(blank=True, null=True)
    exercise_data = models.JSONField(blank=True, null=True)
    source_hash = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Hash of the English source at translation time, used for staleness detection.",
    )

    class Meta:
        db_table = "education_lessonsection_translation"
        unique_together = [("section", "language")]


class QuizTranslation(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=10, db_index=True)
    title = models.CharField(max_length=200)
    question = models.TextField()
    choices = models.JSONField()
    correct_answer = models.CharField(max_length=200)

    class Meta:
        db_table = "education_quiz_translation"
        unique_together = [("quiz", "language")]


class PathPlan(models.Model):
    """
    Stores per-course AI-generated reasons and rank for a user's personalized path.
    Updated daily by the path generator.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="path_plans")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="path_plans")
    rank = models.PositiveSmallIntegerField(default=1)
    reason = models.TextField(blank=True, default="")
    micro_goal = models.CharField(max_length=300, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "education_path_plan"
        unique_together = [("user", "course")]
        ordering = ["rank"]

    def __str__(self):
        return f"PathPlan({self.user_id}, course={self.course_id}, rank={self.rank})"


class ContentEmbedding(models.Model):
    """
    Stores OpenAI text embeddings for curriculum content (lessons, courses, skills).
    Use pgvector VectorField in production for fast ANN search.
    Until pgvector migration, embedding is stored as JSON and similarity computed in Python.
    """

    CONTENT_TYPE_CHOICES = [
        ("lesson", "Lesson"),
        ("course", "Course"),
        ("section", "Section"),
        ("skill", "Skill"),
    ]

    content_type = models.CharField(max_length=16, choices=CONTENT_TYPE_CHOICES, db_index=True)
    content_id = models.PositiveIntegerField(db_index=True)
    title = models.CharField(max_length=300)
    body_snippet = models.TextField(blank=True, default="")
    embedding = models.JSONField(help_text="List[float] from text-embedding-3-small (1536-d)")
    embedding_model = models.CharField(max_length=64, default="text-embedding-3-small")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "education_content_embedding"
        unique_together = [("content_type", "content_id")]
        indexes = [models.Index(fields=["content_type", "updated_at"])]

    def __str__(self):
        return f"{self.content_type}:{self.content_id} — {self.title[:60]}"


class ExerciseTranslation(models.Model):
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=10, db_index=True)
    question = models.TextField()
    exercise_data = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = "education_exercise_translation"
        unique_together = [("exercise", "language")]
