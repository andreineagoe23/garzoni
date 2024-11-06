from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    earned_money = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return self.user.username

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
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    short_description = models.TextField(blank=True)
    detailed_content = models.TextField()
    image = models.ImageField(upload_to='lesson_images/', blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    class Meta:
        verbose_name = "Lesson"
        verbose_name_plural = "Lessons"

class Quiz(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quizzes")
    question = models.TextField()
    correct_answer = models.CharField(max_length=200)

    def __str__(self):
        return f"Quiz for {self.lesson.title}: {self.question[:50]}"

    class Meta:
        verbose_name = "Quiz"
        verbose_name_plural = "Quizzes"

class UserProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="progress")
    course = models.ForeignKey('Course', on_delete=models.CASCADE, related_name="user_progress")
    completed_lessons = models.IntegerField(default=0) 
    is_course_complete = models.BooleanField(default=False) 

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"

    class Meta:
        verbose_name = "User Progress"
        verbose_name_plural = "User Progress"